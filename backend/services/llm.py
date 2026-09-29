"""
llm.py — Phase 4: the grounded explanation layer (Groq, OpenAI-compatible chat completions).

THE ONE RULE
    The model receives EXACTLY `evidence.model_dump()`. No tools, no history, no retrieval, no
    second data call. It turns a validated evidence object into a sentence; it cannot turn a
    sentence into evidence. Everything the model may assert is already decided upstream:
    `advisory.risk_level`, `evidence_quality`, `sources[]`, `alerts[]`, `validation.sufficient`.

WHY THE PROMPT LOOKS RESTRICTIVE
    It is a copy of docs/PLAN_48H.md §F extended with the four rules that Phase 4 has to enforce
    (risk preservation, no tools, alert-id discipline, unavailable-vs-no-alerts). The prompt is
    not the guard: `grounding.verify()` is. A prompt makes the model usually right; the verifier
    makes it provably never wrong about the four fields that matter.

FAILURE POLICY (the whole point of this phase)
    no key / disabled / timeout / HTTP error / unparseable JSON / grounding rejection after one
    regeneration  ->  `deterministic_answer()` builds the sentence from evidence values only.
    The user still gets a grounded answer with a visible origin badge; the weather product never
    becomes unavailable because the LLM is. `llm_status` on the trace records which path ran, so
    the demo can show it instead of asserting it.

GROQ NOTES (verified against their docs before writing this)
    base https://api.groq.com/openai/v1/chat/completions, OpenAI-compatible, model
    llama-3.3-70b-versatile supports `response_format={"type":"json_object"}`, which is why the
    answer arrives as JSON and needs no prose parsing.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from backend import config
from backend.models import Evidence, GroundedAnswer, GroundingReport
from backend.services import grounding, http_client
from backend.services import validation as validation_service

# --------------------------------------------------------------------------- #
# prompt
# --------------------------------------------------------------------------- #
SYSTEM_PROMPT = """You are the explanation layer of WeatherGPT, a travel-risk assistant for Maharashtra.

You receive ONE JSON object: the verified evidence for a single user question. It is the whole
world for this turn. You have no tools and you must not ask for more data.

Produce ONLY a JSON object, no prose around it, with exactly these keys:
  "answer":            one or two sentences of plain Indian English answering the question asked.
  "source":            the provider name(s) to credit, copied from evidence.sources[].name.
  "timestamp":         the "as of" stamp, copied from evidence.sources[].timestamp or
                       evidence.weather.retrieved_at_utc.
  "risk":              the value of evidence.advisory.risk_level, copied exactly.
  "evidence_quality":  the value of evidence.evidence_quality, copied exactly.

Hard rules. Each one is checked programmatically after you reply, and a single violation discards
your entire answer, so do not test them:
1. Every number you write must appear in the evidence object, with the same unit, to one decimal
   place. Never compute, average, round up, convert units, or fill a gap with a plausible value.
   If a value is not in the evidence, do not mention it.
2. You have no tools. Do not request data, and do not mention data you were not given.
3. Do not change the risk level or the evidence quality. If the advisory says MEDIUM, the answer
   says the risk is MEDIUM. You may explain WHY (the rules in evidence.advisory.rules_fired and
   warnings), you may not decide otherwise.
4. If evidence.alerts.items is not empty, the answer MUST mention that official alert (its event
   and severity) before or while answering. Silence about a live warning is the most dangerous
   failure you can commit.
5. Only cite alert identifiers that literally appear in evidence.alerts.items[].alert_id. Never
   invent one.
6. If evidence.alerts.state is "unavailable" or "not_checked", say that the official alert service
   could not be verified at this time. That is NOT the same as "there are no alerts" — never imply
   the absence of alerts in that case.
7. When a value you need is missing from the evidence, say that it is not available. Do not use a
   neighbouring day's value, a regional average, or a number from your own memory of the climate.
8. A value that only exists in a forecast day block (today/tomorrow/target_day, is_forecast=true)
   must be attributed to that day and timeframe. Never describe it as "now" or "currently".
9. Quote the "as of" time you copied. Do not present a value as more current than it is.
10. If evidence.validation.sufficient is false, say plainly that reliable information could not be
    verified and that you will not guess. Do not soften it, and do not summarise the rejected
    numbers as if they were trustworthy.
11. Never guarantee personal safety, never order an evacuation, never claim official authority.
    State the weather-related risk and what the evidence is.
12. No greetings, no advice beyond the data, no bullet lists, no markdown, no disclaimers added
    to the ones above. Keep the answer under 60 words.

Conversation metadata (inside evidence.request):
13. evidence.request.topic tells you the practical question THIS turn asks: weather_summary,
    rain_prediction, umbrella_advice, travel_safety, outdoor_suitability, temperature,
    official_alert, or historical_climate. Answer THAT question directly — the same evidence can
    support different answers (rain amount vs. umbrella advice vs. travel risk); do not always
    lead with a generic weather summary.
14. evidence.request.response_language sets the language of "answer": "en" = Indian English,
    "hi" = Hindi (Devanagari), "mr" = Marathi (Devanagari), "hinglish" = natural Romanized
    colloquial Hindi (Latin script, e.g. "Kal Mumbai mein baarish ho sakti hai"). Keep every
    number, unit, and place value exactly as in the evidence (25.4 °C, 5 mm, 100%, risk words);
    only the surrounding prose changes language. The JSON keys and source/risk/quality values
    stay English.
"""

# The regeneration message: exact failures, one stricter attempt, same evidence object.
REGEN_HEADER = (
    "Your previous reply was rejected by the grounding verifier. It is the ONLY correction you "
    "will get, and if anything on this list is still wrong your reply will be discarded and a "
    "deterministic answer will be shown instead. Re-read the hard rules, then answer again from "
    "the same evidence object. Reject reasons:\n"
)


def evidence_json(ev: Evidence) -> str:
    """The single user message: the evidence dump, nothing else, stable key order."""
    return json.dumps(
        ev.model_dump(mode="json", exclude_none=False), ensure_ascii=False, sort_keys=False
    )


def build_messages(ev: Evidence, failures: Optional[List[str]] = None) -> List[Dict[str, str]]:
    """system + ONE user message. No history, by construction: the list is always 2 items
    (3 on the regeneration, where the second user turn only contains the verifier's complaints)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    user = evidence_json(ev)
    if failures:
        user += "\n\n" + REGEN_HEADER + "\n".join(f"- {f}" for f in failures)
    messages.append({"role": "user", "content": user})
    return messages


# --------------------------------------------------------------------------- #
# transport
# --------------------------------------------------------------------------- #
def _endpoint() -> str:
    return config.GROQ_BASE_URL.rstrip("/") + config.LLM_CHAT_COMPLETIONS_PATH


def llm_configured() -> bool:
    return bool(config.GROQ_API_KEY)


async def _chat(messages: List[Dict[str, str]]) -> str:
    """One Groq chat-completion request, returning the assistant message content as a string."""
    if config.SIMULATE_LLM_FAILURE:
        raise http_client.UpstreamError(
            "groq", "SIMULATE_LLM_FAILURE is set (acts like the endpoint being unreachable)"
        )
    payload: Dict[str, Any] = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": config.LLM_MAX_TOKENS,
        "stream": False,
        "include_reasoning": False,
        "reasoning_effort": "low",
    }
    if config.LLM_JSON_MODE:
        payload["response_format"] = {"type": "json_object"}
    body = await http_client.post_json(
        _endpoint(),
        payload=payload,
        service="groq",
        headers={
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "WeatherGPT/1.0",
        },
        timeout=config.LLM_TIMEOUT_S,
        retries=0,
    )
    if not isinstance(body, dict) or not body.get("choices"):
        raise http_client.UpstreamError("groq", "response contained no choices[]")
    message = body["choices"][0].get("message") or {}
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise http_client.UpstreamError("groq", "assistant message content was empty")
    return content


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def parse_json_object(raw: str) -> Optional[Dict[str, Any]]:
    """Parse the reply into a dict. Tolerates markdown fences and a leading sentence; anything
    that still is not a JSON object returns None so the caller can fall back deterministically."""
    if not raw:
        return None
    text = raw.strip()
    fence = re.match(r"^```[a-zA-Z]*\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        obj = json.loads(text)
    except ValueError:
        block = _JSON_BLOCK.search(text)
        if not block:
            return None
        try:
            obj = json.loads(block.group(0))
        except ValueError:
            return None
    return obj if isinstance(obj, dict) else None


# --------------------------------------------------------------------------- #
# deterministic fallback
# --------------------------------------------------------------------------- #
def _stamp(value: Any, *, utc: bool = True) -> str:
    """Minute-precision, unambiguous stamps in the SENTENCE.

    The machine-readable `timestamp` field keeps the evidence's exact string (the verifier compares
    that one); prose gets "2026-09-01T00:59Z" / "…T03:15 local" so a reader can tell which clock is
    meant — the provider answers current conditions in local wall time and everything else in UTC.
    """
    text = str(value or "").strip()
    if not text:
        return ""
    match = re.match(r"^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})", text)
    if not match:
        return text
    date, hhmm = match.groups()
    if not utc:
        return f"{date}T{hhmm} local"
    return f"{date}T{hhmm}Z" if ("Z" in text or "+" in text or "-" in text[10:]) else f"{date}T{hhmm} UTC"


def _punct(text: str) -> str:
    text = (text or "").strip()
    return text + "." if text and not text.endswith((".", "!", "?")) else text


def _safe_quote(text: str) -> str:
    """An official text prepared for verbatim quoting inside our answer.

    The words are NOT altered (a paraphrased instruction is no longer the authority's), but
    whitespace is collapsed and inner double quotes become single ones, because the grounding
    verifier strips quoted spans before judging wording — an unbalanced quote would let the
    quote swallow prose this answer is responsible for.
    """
    return re.sub(r"\s+", " ", (text or "").strip()).replace('"', "'")


def _fmt(value: Any) -> str:
    """Numbers are rendered exactly as the evidence holds them (°C to one decimal, mm as-is)."""
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        if abs(value - round(value)) < 1e-9:
            return str(int(round(value)))
        return f"{value:.1f}".rstrip("0").rstrip(".")
    return str(value)


def _sources(ev: Evidence) -> str:
    names: List[str] = []
    for src in ev.sources:
        if src.name and src.name not in names:
            names.append(src.name)
    return " + ".join(names) if names else "no usable source"


def _as_of(ev: Evidence) -> Optional[str]:
    for src in ev.sources:
        if src.timestamp:
            return src.timestamp
    if ev.weather and ev.weather.retrieved_at_utc:
        return ev.weather.retrieved_at_utc
    if ev.alerts and ev.alerts.checked_at_utc:
        return ev.alerts.checked_at_utc
    return None


def _answered_block(ev: Evidence) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """(date, values) for the day the question was about, or (None, None) for a current answer.

    Reuses `validation.answered_day`, the same selector Phase 3 used to decide which day block the
    answer must come from — so the fallback cannot drift onto a different day than the validation
    and advisory already agreed on.
    """
    request = ev.request or {}
    timeframe = str(request.get("timeframe") or "now").lower()
    if timeframe in ("now", "current", "today_and_tomorrow", ""):
        return None, None
    day = validation_service.answered_day(ev.weather, timeframe, request.get("target_date"))
    if day is None:
        return None, None
    # Prefer the human label ("Tomorrow", "Today") over the ISO date for prose; the block dict
    # still carries the exact date for grounding.
    phrase = getattr(day, "label", None) or day.date
    return phrase, day.model_dump(mode="json")


def _measurement_sentence(ev: Evidence) -> str:
    date, block = _answered_block(ev)
    if block:
        bits = []
        if block.get("temperature_max_c") is not None:
            bits.append(f"up to {_fmt(block['temperature_max_c'])} °C")
        if block.get("temperature_min_c") is not None:
            bits.append(f"down to {_fmt(block['temperature_min_c'])} °C")
        if block.get("precipitation_sum_mm") is not None:
            chance = block.get("precipitation_probability_max_pct")
            rain = f"{_fmt(block['precipitation_sum_mm'])} mm of rain"
            if chance is not None:
                rain += f" ({_fmt(chance)}% chance)"
            bits.append(rain)
        if block.get("wind_speed_max_kmh") is not None:
            bits.append(f"wind up to {_fmt(block['wind_speed_max_kmh'])} km/h")
        if block.get("condition"):
            bits.append(str(block["condition"]))
        label = f"For {str(date).lower()}" if date else "For the requested day"
        return f"{label}: " + (", ".join(bits) if bits else "no numeric values were returned") + "."
    cur = ev.weather.current if ev.weather else None
    if cur is None:
        return "The evidence carries no current weather block, so no conditions can be stated."
    bits = []
    if cur.temperature_c is not None:
        bits.append(f"{_fmt(cur.temperature_c)} °C")
    if cur.apparent_temperature_c is not None:
        bits.append(f"feels like {_fmt(cur.apparent_temperature_c)} °C")
    if cur.precipitation_mm is not None:
        bits.append(f"{_fmt(cur.precipitation_mm)} mm precipitation")
    if cur.humidity_pct is not None:
        bits.append(f"{_fmt(cur.humidity_pct)}% humidity")
    if cur.wind_speed_kmh is not None:
        bits.append(f"wind {_fmt(cur.wind_speed_kmh)} km/h")
    if cur.condition:
        bits.append(str(cur.condition))
    if not bits:
        return "The current block carried no usable values."
    when = f" as of {_stamp(cur.time, utc=False)}" if cur.time else ""
    return "Currently " + ", ".join(bits) + f"{when}."


# --------------------------------------------------------------------------- #
# U4: topic-aware + language-aware deterministic answer
# --------------------------------------------------------------------------- #
_TOPIC_LABELS = {
    "weather_summary": "weather_summary", "rain_prediction": "rain_prediction",
    "umbrella_advice": "umbrella_advice", "travel_safety": "travel_safety",
    "outdoor_suitability": "outdoor_suitability", "temperature": "temperature",
    "official_alert": "official_alert", "historical_climate": "historical_climate",
}
_LANGS = {"en", "hi", "mr", "hinglish"}


def _topic_of(ev: Evidence) -> str:
    topic = str((ev.request or {}).get("topic") or "other")
    return topic if topic in _TOPIC_LABELS else "other"


def _language_of(ev: Evidence) -> str:
    lang = str((ev.request or {}).get("response_language") or "en").lower()
    return lang if lang in _LANGS else "en"


def _place_name(ev: Evidence) -> str:
    loc = ev.location
    if loc is not None and loc.name:
        return loc.name
    lt = (ev.request or {}).get("location_text")
    return str(lt) if lt else "this location"


def _rain_numbers(ev: Evidence) -> Tuple[Optional[Any], Optional[Any], str]:
    """(mm, chance%, day phrase) for the answered day — values copied, never computed."""
    _date, block = _answered_block(ev)
    if block is not None:
        return (block.get("precipitation_sum_mm"),
                block.get("precipitation_probability_max_pct"),
                str(_date) if _date else "the requested day")
    cur = ev.weather.current if ev.weather else None
    if cur is not None:
        return cur.precipitation_mm, None, "right now"
    return None, None, "right now"


def _risk_word(ev: Evidence) -> str:
    if ev.advisory is not None:
        return str(ev.advisory.risk_level or "UNCERTAIN")
    return str(ev.risk or "UNCERTAIN")


def _topic_lead(ev: Evidence) -> Optional[str]:
    """A short, topic-specific, evidence-grounded opening sentence for the deterministic answer.

    Every value is copied from the same day/current block the rest of the answer uses, and every
    hedge is conditional on a value existing, so it cannot invent a number. Returns None for
    abstentions/topics without a dedicated opener (the caller falls back to the generic text).
    """
    topic = _topic_of(ev)
    lang = _language_of(ev)
    place = _place_name(ev)
    mm, chance, day = _rain_numbers(ev)
    risk = _risk_word(ev)
    active_alert = any(a.validity == "active" for a in (ev.alerts.items or []))
    alerts_unknown = ev.alerts.state in ("unavailable", "not_checked")
    day_word = "tomorrow" if str(day).lower().startswith("tomorrow") else str(day)
    hi_day = "कल" if day_word == "tomorrow" else day_word
    mr_day = "उद्या" if day_word == "tomorrow" else day_word

    # English openers --------------------------------------------------------- #
    if lang in ("en", "hinglish"):
        when = f"{day_word} " if str(day).lower() != "right now" else ""
        if topic == "rain_prediction":
            if mm is None and chance is None:
                return "I could not verify a rainfall amount for that period."
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            bits = []
            if mm is not None:
                bits.append(f"around {mm} mm of rain")
            if chance is not None:
                bits.append(f"a {chance}% chance of precipitation")
            detail = ", ".join(bits) if bits else "no measurable rainfall in the forecast"
            head = "Yes, rain is likely" if likely else "Rain is unlikely"
            return f"{head} {when}in {place} — the forecast shows {detail}."
        if topic == "umbrella_advice":
            if mm is None and chance is None:
                return "I couldn't verify the rainfall forecast, so I can't confidently advise on an umbrella."
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            bits = []
            if mm is not None:
                bits.append(f"around {mm} mm expected")
            if chance is not None:
                bits.append(f"a {chance}% chance of rain")
            detail = " (" + ", ".join(bits) + ")" if bits else ""
            if likely:
                return f"Yes, I would carry an umbrella {when}in {place}{detail}."
            return f"You probably will not need an umbrella {when}in {place}{detail}."
        if topic == "travel_safety":
            if active_alert:
                return (f"Travel is NOT currently advisable in {place}: there is an active official "
                        f"alert and the weather-related risk is {risk}.")
            if alerts_unknown:
                return (f"Based on the current evidence, travel in {place} has {risk} weather-related "
                        f"risk; the official alert service could not be verified at this time.")
            return (f"Travel looks relatively safe in {place} based on the current evidence, with {risk} "
                    f"weather-related risk and no active official alert found.")
        if topic == "temperature":
            cur = ev.weather.current if ev.weather else None
            _d, block = _answered_block(ev)
            if block and (block.get("temperature_max_c") is not None):
                return (f"{day_word.capitalize()} in {place}: about {_fmt(block['temperature_min_c'])}–"
                        f"{_fmt(block['temperature_max_c'])} °C.")
            if cur and cur.temperature_c is not None:
                feels = f", feels like {_fmt(cur.apparent_temperature_c)} °C" if cur.apparent_temperature_c is not None else ""
                return f"It is {_fmt(cur.temperature_c)} °C in {place} right now{feels}."
            return None
        if topic == "weather_summary":
            _sd, sblock = _answered_block(ev)
            if sblock and sblock.get("condition"):
                cond = str(sblock.get("condition") or "").strip()
                tmax = sblock.get("temperature_max_c")
                tpart = f", about {_fmt(sblock['temperature_min_c'])}–{_fmt(tmax)} °C" if tmax is not None else ""
                return f"The forecast for {day_word} in {place}: {cond.lower()}{tpart}."
            cur = ev.weather.current if ev.weather else None
            if cur and cur.temperature_c is not None:
                return f"It is {_fmt(cur.temperature_c)} °C in {place} right now."
            return None
        return None

    # Hindi openers ----------------------------------------------------------- #
    if lang == "hi":
        if topic == "rain_prediction":
            if mm is None and chance is None:
                return "इस अवधि के लिए बारिश की मात्रा सत्यापित नहीं हो सकी।"
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            bits = []
            if mm is not None:
                bits.append(f"लगभग {mm} मिमी बारिश")
            if chance is not None:
                bits.append(f"वर्षा की संभावना {chance}%")
            detail = ", ".join(bits)
            head = "हाँ, बारिश की संभावना बहुत अधिक है" if likely else "बारिश की संभावना कम है"
            return f"{head} — {hi_day} {place} में {detail}।"
        if topic == "umbrella_advice":
            if mm is None and chance is None:
                return "बारिश का पूर्वानुमान सत्यापित नहीं हो सका, इसलिए छाते की सलाह नहीं दे सकता।"
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            bits = [f"लगभग {mm} मिमी" for _ in [0] if mm is not None]
            if chance is not None:
                bits.append(f"{chance}% संभावना")
            detail = (" (" + ", ".join(bits) + ")") if bits else ""
            if likely:
                return f"हाँ, {hi_day} {place} में छाता साथ रखें{detail}।"
            return f"{hi_day} {place} में छाते की ज़रूरत कम लगती है{detail}।"
        if topic == "travel_safety":
            if active_alert:
                return (f"{place} में अभी यात्रा उचित नहीं है: एक सक्रिय आधिकारिक चेतावनी है और "
                        f"मौसम-संबंधी जोखिम {risk} है।")
            if alerts_unknown:
                return (f"मौजूदा साक्ष्य के अनुसार {place} में यात्रा का मौसम-संबंधी जोखिम {risk} है; "
                        f"इस समय आधिकारिक चेतावनी सेवा सत्यापित नहीं हो सकी।")
            return (f"मौजूदा साक्ष्य के अनुसार {place} में यात्रा अपेक्षाकृत सुरक्षित है — मौसम-संबंधी "
                    f"जोखिम {risk} है और कोई सक्रिय आधिकारिक चेतावनी नहीं मिली।")
        if topic == "temperature":
            cur = ev.weather.current if ev.weather else None
            _d, block = _answered_block(ev)
            if block and block.get("temperature_max_c") is not None:
                return f"{hi_day} {place} में तापमान लगभग {_fmt(block['temperature_min_c'])}–{_fmt(block['temperature_max_c'])} °C।"
            if cur and cur.temperature_c is not None:
                return f"{place} में अभी तापमान {_fmt(cur.temperature_c)} °C है।"
            return None
        if topic == "weather_summary":
            _sd, sblock = _answered_block(ev)
            if sblock and sblock.get("temperature_max_c") is not None:
                return (f"{hi_day} {place} में तापमान लगभग {_fmt(sblock['temperature_min_c'])}–"
                        f"{_fmt(sblock['temperature_max_c'])} °C रहने का अनुमान है।")
            cur = ev.weather.current if ev.weather else None
            if cur and cur.temperature_c is not None:
                return f"{place} में अभी तापमान {_fmt(cur.temperature_c)} °C है।"
            return None
        return None

    # Marathi openers --------------------------------------------------------- #
    if lang == "mr":
        if topic == "rain_prediction":
            if mm is None and chance is None:
                return "त्या कालावधीसाठी पावसाचे प्रमाण पडताळता आले नाही."
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            bits = []
            if mm is not None:
                bits.append(f"सुमारे {mm} मिमी पाऊस")
            if chance is not None:
                bits.append(f"पावसाची शक्यता {chance}%")
            detail = ", ".join(bits)
            head = "होय, पावसाची शक्यता जास्त आहे" if likely else "पावसाची शक्यता कमी आहे"
            return f"{head} — {mr_day} {place} मध्ये {detail}."
        if topic == "umbrella_advice":
            if mm is None and chance is None:
                return "पावसाचा अंदाज पडताळता आला नाही, त्यामुळे छत्रीबद्दल सल्ला देता येत नाही."
            likely = (chance is not None and float(chance) >= 50) or (mm is not None and float(mm) >= 1.0)
            if likely:
                return f"होय, {mr_day} {place} मध्ये छत्री बाळगा."
            return f"{mr_day} {place} मध्ये छत्रीची गरज भासणार नाही."
        if topic == "travel_safety":
            if active_alert:
                return (f"{place} मध्ये सध्या प्रवास योग्य नाही: एक सक्रिय अधिकृत चेतावणी आहे आणि "
                        f"हवामान-संबंधित धोका {risk} आहे.")
            if alerts_unknown:
                return (f"सध्याच्या पुराव्यानुसार {place} मध्ये प्रवासाचा हवामान-संबंधित धोका {risk} आहे; "
                        f"अधिकृत चेतावणी सेवा या वेळी पडताळता आली नाही.")
            return (f"सध्याच्या पुराव्यानुसार {place} मध्ये प्रवास तुलनेने सुरक्षित आहे — हवामान-संबंधित "
                    f"धोका {risk} आहे आणि कोणतीही सक्रिय अधिकृत चेतावणी आढळली नाही.")
        if topic == "temperature":
            cur = ev.weather.current if ev.weather else None
            _d, block = _answered_block(ev)
            if block and block.get("temperature_max_c") is not None:
                return f"{mr_day} {place} मध्ये तापमान सुमारे {_fmt(block['temperature_min_c'])}–{_fmt(block['temperature_max_c'])} °C."
            if cur and cur.temperature_c is not None:
                return f"{place} मध्ये सध्या तापमान {_fmt(cur.temperature_c)} °C आहे."
            return None
        if topic == "weather_summary":
            _sd, sblock = _answered_block(ev)
            if sblock and sblock.get("temperature_max_c") is not None:
                return (f"{mr_day} {place} मध्ये तापमान सुमारे {_fmt(sblock['temperature_min_c'])}–"
                        f"{_fmt(sblock['temperature_max_c'])} °C राहण्याचा अंदाज आहे.")
            cur = ev.weather.current if ev.weather else None
            if cur and cur.temperature_c is not None:
                return f"{place} मध्ये सध्या तापमान {_fmt(cur.temperature_c)} °C आहे."
            return None
        return None
    return None


def _measurement_sentence_localized(ev: Evidence, lang: str) -> str:
    """A short, value-only factual tail for Hindi/Marathi. Numbers/units stay Latin and
    unchanged (so grounding sees the exact evidence figures); connective words only are
    localized. Only temperature is added here — rain mm/probability already appear in the
    topic lead inside a day-framed clause, and repeating a forecast number in a frameless
    clause would trip the current-vs-forecast grounding check."""
    _date, block = _answered_block(ev)
    if block:
        pieces: List[str] = []
        if block.get("temperature_max_c") is not None:
            pieces.append(
                f"तापमान {_fmt(block['temperature_min_c'])}–{_fmt(block['temperature_max_c'])} °C"
            )
        if pieces:
            lead = "पूर्वानुमान: " if lang == "hi" else "अंदाज: "
            return lead + ", ".join(pieces) + "।"
        return ""
    cur = ev.weather.current if ev.weather else None
    if cur is not None and cur.temperature_c is not None:
        head = "अभी: " if lang == "hi" else "सध्या: "
        return f"{head}{_fmt(cur.temperature_c)} °C।"
    return ""


def deterministic_payload(ev: Evidence) -> Dict[str, Any]:
    """A grounded answer assembled from evidence values only — no model, no invention.

    Deliberately reuses the wording the advisory/validation layer already produced (the advisory
    headline is already phrased as weather-related risk, not a safety guarantee), so the fallback
    cannot drift from the decision it is supposed to explain.
    """
    payload: Dict[str, Any] = {
        "answer": "",
        "source": _sources(ev),
        "timestamp": _as_of(ev),
        "risk": str(ev.advisory.risk_level if ev.advisory else (ev.risk or "UNCERTAIN")),
        "evidence_quality": str(ev.evidence_quality or "LOW"),
    }
    # A clarification (e.g. "which city?") is a question, not an abstention: return the
    # already-localized clarification text directly (U4: the question follows the user's
    # selected voice language).
    if ev.status == "clarify" and ev.clarification:
        payload["answer"] = ev.clarification
        return payload

    validation = ev.validation
    if validation is not None and not validation.sufficient:
        reason = validation.failures[0] if validation.failures else (ev.abstain_reason or "")
        # Credit what exists, and only what exists: no sources => no source line; an as-of stamp
        # from the alert check is still quoted so the abstention itself is dated.
        bits = []
        if ev.sources:
            bits.append(f"Source: {payload['source']}")
        if payload["timestamp"]:
            bits.append(("as of " if bits else "Checked at ") + _stamp(payload["timestamp"]))
        tail = (" " + ", ".join(bits) + ".") if bits else ""
        payload["answer"] = (
            "I could not verify reliable weather information for this place and time, so I will "
            "not guess."
            + (f" Reason: {reason}." if reason else "")
            + tail
        )
        if not ev.sources:
            payload["source"] = "no usable source"
        return payload

    response_lang = _language_of(ev)
    localized = response_lang in ("hi", "mr")
    parts: List[str] = []

    # U4: topic-specific opener FIRST, so a rain/umbrella/travel/temperature question reads as a
    # direct answer to that question instead of a generic alert/measurement paragraph.
    lead = _topic_lead(ev)
    if lead:
        parts.append(lead)

    alerts = ev.alerts
    items = list(alerts.items) if alerts and alerts.items else []
    if items:
        alert = items[0]
        desc = " ".join(x for x in (alert.severity, alert.event) if x)
        if localized:
            # Localized alert-status line; the authority's verbatim instruction is still attached
            # unchanged (it is the official text and must not be paraphrased).
            if alert.validity == "active":
                line = f"इस क्षेत्र के लिए एक आधिकारिक {desc or 'चेतावनी'} चेतावनी सक्रिय है।" if response_lang == "hi" \
                    else f"या भागासाठी एक अधिकृत {desc or 'चेतावणी'} चेतावणी सक्रिय आहे."
            else:
                line = ("एक आधिकारिक चेतावनी प्रकाशित हुई थी, परंतु स्रोत से यह साबित नहीं होता कि वह अभी सक्रिय है।"
                        if response_lang == "hi"
                        else "एक अधिकृत चेतावणी प्रसिद्ध झाली होती, परंतु ती आता सक्रिय आहे हे स्रोतावरून सिद्ध होत नाही.")
            if alert.instruction:
                sender = alert.sender or alert.author_name or "the issuing authority"
                line += (f" {sender} की आधिकारिक हिदायत: " if response_lang == "hi"
                         else f" {sender} ची अधिकृत सूचना: ")
                line += f'"{_safe_quote(alert.instruction)}".'
            if len(items) > 1:
                line += (f" इस स्थान से {len(items)} सत्यापित आधिकारिक चेतावनियाँ जुड़ी हैं।"
                         if response_lang == "hi"
                         else f" या ठिकाणाशी {len(items)} पडताळलेल्या अधिकृत चेतावणी जोडलेल्या आहेत.")
            parts.append(line)
        else:
            if alert.validity == "active":
                line = f"An official {desc} alert is active for {alert.area_desc or 'this area'}"
                if alert.expires_at:
                    line += f" until {_stamp(alert.expires_at)}"
            else:
                # U1 boundary: a relevant alert whose temporal window the source left unprovable
                # (validity == "unknown", e.g. no expiry published) must NOT be sold as "active".
                # Only alerts.py's classify_validity() may declare an alert active.
                line = (
                    f"An official {desc} alert naming {alert.area_desc or 'this area'} was published, "
                    f"but the source does not prove it is active right now "
                    f"({_punct(alert.validity_reason or 'temporal window not published')[:-1].lower()})"
                )
            line += ". "
            if alert.headline:
                line += _punct(alert.headline)
            if alert.instruction:
                # U1: the issuing authority's instruction, quoted VERBATIM (never paraphrased, never
                # invented when absent). Attribution stays attached so it cannot read as our advice.
                line += (
                    f" Official instruction from "
                    f"{alert.sender or alert.author_name or 'the issuing authority'}: "
                    f'"{_safe_quote(alert.instruction)}".'
                )
            if len(items) > 1:
                line += f" {len(items)} verified official alerts are attached to this location."
            parts.append(line)
    elif alerts is not None and alerts.state in ("unavailable", "not_checked"):
        if response_lang == "hi":
            parts.append("इस समय आधिकारिक चेतावनी सेवा सत्यापित नहीं हो सकी, इसलिए इस स्थान के लिए कोई चेतावनी सक्रिय है या नहीं, यह अज्ञात है।")
        elif response_lang == "mr":
            parts.append("या वेळी अधिकृत चेतावणी सेवा पडताळता आली नाही, त्यामुळे या ठिकाणासाठी चेतावणी सक्रिय आहे की नाही हे अनिश्चित आहे.")
        else:
            parts.append(
                "The official alert service could not be verified at this time, so whether any alert "
                "is active for this location is unknown and no conclusion about alerts can be drawn "
                "from this answer."
            )
    elif alerts is not None and alerts.state == "checked":
        when = f" at {_stamp(alerts.checked_at_utc)}" if alerts.checked_at_utc \
            else " at the time of the check"
        if response_lang == "hi":
            parts.append("SACHET जाँच में इस स्थान के लिए कोई सक्रिय आधिकारिक चेतावनी नहीं मिली "
                         "(यह जाँच का परिणाम है, यह गारंटी नहीं कि कोई चेतावनी नहीं है)।")
        elif response_lang == "mr":
            parts.append("SACHET तपासणीत या ठिकाणासाठी कोणतीही सक्रिय अधिकृत चेतावणी आढळली नाही "
                         "(हा तपासणीचा निकाल आहे, चेतावणी नाही याची खात्री नाही).")
        else:
            parts.append(
                f"No active official alert was verifiably tied to this location when SACHET was checked{when};"
                " that is a checked result, not a promise that none exists."
            )

    # Factual measurement tail: localized (temperature only) for hi/mr, full body for en/hinglish.
    parts.append(_measurement_sentence_localized(ev, response_lang) if localized
                 else _measurement_sentence(ev))

    if ev.advisory is not None and ev.advisory.headline:
        score = (ev.quality_breakdown or {}).get("score")
        line = ev.advisory.headline
        if score is not None:
            line += f" Evidence quality {payload['evidence_quality']} ({_fmt(score)}/100)."
        if not localized:
            parts.append(line)
        # hi/mr: the travel-safety topic lead already states the risk in-language; the English
        # advisory headline is skipped so no English sentence bleeds into a Devanagari answer.
    # validation.warnings are deliberately NOT inlined: they quote the wording they warn about
    # ("...NOT the same as 'no alert exists'"), and a sentence that quotes a forbidden phrase in
    # the fallback would trip the same check the LLM is held to. The evidence panel shows them.

    text = re.sub(r"\s+", " ", " ".join(part for part in parts if part)).strip()
    if not text.endswith((".", "!", "?", "।")):
        text += "।" if localized else "."
    if localized:
        # Localized source trailer ("स्रोत: … तक।" / "… पर्यंत।").
        trailer = f"स्रोत: {payload['source']}"
        if payload["timestamp"]:
            end_word = "तक" if response_lang == "hi" else "पर्यंत"
            trailer += f", {_stamp(payload['timestamp'])} {end_word}।"
        else:
            trailer += "।"
    else:
        trailer = f"Source: {payload['source']}"
        if payload["timestamp"]:
            trailer += f", as of {_stamp(payload['timestamp'])}."
        else:
            trailer += "."
    payload["answer"] = f"{text} {trailer}"
    return payload


# --------------------------------------------------------------------------- #
# orchestration
# --------------------------------------------------------------------------- #
def _wrap(payload: Dict[str, Any], ev: Evidence, origin: str, report: GroundingReport) -> GroundedAnswer:
    text = re.sub(r"\s+", " ", str(payload.get("answer") or "")).strip()
    return GroundedAnswer(
        text=text,
        source=(str(payload.get("source")).strip() if payload.get("source") else None) or None,
        timestamp=(str(payload.get("timestamp")).strip() if payload.get("timestamp") else None) or None,
        risk=str(payload.get("risk") or (ev.advisory.risk_level if ev.advisory else "UNCERTAIN")),
        evidence_quality=str(payload.get("evidence_quality") or ev.evidence_quality or "LOW"),
        alert_mentioned=grounding.alert_mentioned(text, ev),
        origin=origin,
        grounding=report,
    )


def _fallback(
    ev: Evidence,
    status: str,
    note: str,
    started: float,
    *,
    rejected: Optional[GroundingReport] = None,
    attempts: int = 0,
    regenerated: bool = False,
) -> Tuple[GroundedAnswer, GroundingReport]:
    """Deterministic answer, put through the SAME verifier a model answer must pass.

    `verified` keeps one meaning throughout this module: the answer that will be displayed is
    faithful to the evidence object. Whatever the model got wrong is still recorded, prefixed with
    "[rejected model reply]", so a reviewer can see why the fallback ran without having to guess.
    """
    payload = deterministic_payload(ev)
    report = grounding.verify(ev, payload)
    report.model = None
    report.llm_status = status
    report.attempts = attempts
    report.regenerated = regenerated
    report.note = note + (f" | {report.note}" if report.note else "")
    report.latency_ms = round((time.perf_counter() - started) * 1000.0, 1)
    if rejected is not None:
        report.failures = [f"[rejected model reply] {f}" for f in rejected.failures] + list(
            report.failures
        )
        report.numbers_rejected = list(rejected.numbers_rejected)
    return _wrap(payload, ev, "deterministic_fallback", report), report


async def explain(ev: Evidence) -> Tuple[GroundedAnswer, GroundingReport]:
    """Ask Groq to explain the evidence, verify it, allow exactly one regeneration, else fall back.

    Never raises and never returns an unverified model sentence: every exit is either a model
    answer that passed all grounding checks or `deterministic_payload(ev)`.
    """
    started = time.perf_counter()

    # The evidence gate comes FIRST: "we do not let a model dress up unverified data" is a safety
    # rule, while "no key" is only an availability one, and the trace should record the stronger
    # reason when both are true.
    if ev.validation is not None and not ev.validation.sufficient:
        return _fallback(
            ev, "skipped",
            "evidence failed validation — the deterministic abstention is the only permitted "
            "answer and the LLM was not consulted",
            started,
        )
    if not config.LLM_ENABLED:
        return _fallback(ev, "disabled", "LLM_ENABLED=false — the LLM was not called", started)
    if not llm_configured():
        return _fallback(
            ev, "no_key", "GROQ_API_KEY is not set — deterministic evidence-based answer used", started
        )

    messages = build_messages(ev)
    report = GroundingReport(model=config.GROQ_MODEL, llm_status="called")
    status = "no_answer"

    for attempt in range(1, max(1, config.LLM_MAX_ATTEMPTS) + 1):
        report.attempts = attempt
        try:
            raw = await _chat(messages)
        except http_client.UpstreamError as exc:
            # no transport retry and no second request: the timeout already cost LLM_TIMEOUT_S and
            # the fallback is instant, so a dead Groq must not make the endpoint slow as well.
            return _fallback(
                ev, "upstream_error",
                "Groq could not be reached — deterministic evidence-based answer used",
                started,
                rejected=GroundingReport(failures=[f"groq request failed: {exc}"]),
                attempts=attempt,
                regenerated=report.regenerated,
            )

        parsed = parse_json_object(raw)
        if parsed is None:
            status = "malformed_json"
            report = grounding.new_report(
                model=config.GROQ_MODEL, llm_status=status, attempts=attempt,
                failures=["the reply was not a JSON object with the required keys"],
            )
            messages = build_messages(ev, report.failures)   # one stricter attempt, same evidence
            continue

        if config.SIMULATE_LLM_HALLUCINATION:
            # Proves the guard fires. The injected sentence is never displayed: it must be rejected
            # below, and what the user sees is then the deterministic answer.
            parsed = dict(parsed)
            parsed["answer"] = (
                f"{parsed.get('answer', '')} It will be exactly 987.6 °C with 12345% chance of "
                "rain, per IMD."
            )

        report = grounding.verify(ev, parsed)
        report.model = config.GROQ_MODEL
        report.attempts = attempt
        if config.SIMULATE_LLM_HALLUCINATION:
            report.note = ((report.note + " | ") if report.note else "") + (
                "SIMULATE_LLM_HALLUCINATION injected numbers absent from the evidence"
            )
        if report.verified:
            report.llm_status = "ok"
            report.latency_ms = round((time.perf_counter() - started) * 1000.0, 1)
            if attempt > 1:
                report.regenerated = True
                report.note = ((report.note + " | ") if report.note else "") + (
                    f"accepted on attempt {attempt} after one regeneration"
                )
            return _wrap(parsed, ev, "groq_llm", report), report

        status = "grounding_failed"
        messages = build_messages(ev, report.failures)       # THE one regeneration
        report.regenerated = True

    return _fallback(
        ev, status,
        "model reply rejected by grounding — deterministic evidence-based answer used",
        started,
        rejected=report,
        attempts=report.attempts,
        regenerated=True,
    )
