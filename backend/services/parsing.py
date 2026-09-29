"""
parsing.py — Phase 1 minimal, deterministic extraction.

This is intentionally the rule-based fallback from the build plan (mBERT+LoRA classifier
gets swapped in as `router.classify()` later; it must return the same ParsedQuery fields).
Explainable beats clever here: every decision carries a reason string we can show judges.
"""

from __future__ import annotations

import datetime as dt
import re
from typing import Dict, Optional

from backend.models import ParsedQuery, Timeframe

# --- U3 multilingual (Hindi / Marathi / Hinglish) query understanding -------- #
# These patterns ONLY extract intent/timeframe/location slots. They never produce weather
# values — the evidence pipeline still retrieves every number. Devanagari range is
# \u0900-\u097F; common Latin-script Hinglish spellings are included too.
#
# timeframe words (order matters: more specific first)
TIMEFRAME_PATTERNS_MULTILINGUAL: list[tuple[str, Timeframe, str]] = [
    # tomorrow: "kal" (Hindi/Marathi, in a forward-looking phrase), "उद्या" (Marathi),
    # "आने वाला कल". NOTE: bare "kal" is ambiguous in Hindi (yesterday/tomorrow); in a forward
    # question ("...baarish hogi kya?" = future tense) it reads as tomorrow, which is the
    # common forecast case we support. Past-tense "bita kal" is caught by the past rule, but
    # future is checked first here.
    (r"\bउद्या\b|\bउद्य\b|\bआने\s+वाला?\s+कल\b|\btomorrow\b|\btmrw\b|\bकल\b(?![^।]*(?:बीता|गेल्या|थी|था))|\bkal\b",
     "tomorrow", "matched tomorrow keyword (Hindi/Marathi/Hinglish)"),
    # today: "aaj", "आज", "आजच्या"
    (r"\bआज(?:च्या|चा|चे)?\b|\b(?:today|aaj|aj)\b",
     "today", "matched today keyword (Hindi/Marathi/Hinglish)"),
    # now: "अभी", "आत्ता", "right now"
    (r"\bअभी\b|\bआत्ता\b|\bआता\b|\b(?:abhi|atta|atta)\b",
     "now", "matched now keyword (Hindi/Marathi/Hinglish)"),
    # yesterday / past: "बीता कल" (Hindi), "गेल्या/काल" (Marathi yesterday), "yesterday".
    # The forward "कल" (Hindi tomorrow) is handled by the tomorrow rule above, not here.
    (r"\bबीता\s+कल\b|\bगेल्या\b|\bकाल\b|\byesterday\b|\bbita\s+kal\b|\bbeeta\s+kal\b",
     "past", "matched past keyword (Hindi/Marathi/Hinglish)"),
]

# Precipitation / rain vocabulary in Hindi/Marathi/Hinglish, for intent classification.
RAIN_MULTILINGUAL_RE = re.compile(
    r"बारिश|बरसात|पाऊस|पावसाळा|पडेल|पडतोय|पडणार|होगी|होईल|"
    r"\bbaarish\b|\bbarsaat\b|\bpaus\b|\bpavsala\b|\bpadel\b|\bhogi\b|\bhoil\b",
    re.IGNORECASE,
)

# Weather / "mausam/havaamaan" vocabulary.
WEATHER_MULTILINGUAL_RE = re.compile(
    r"मौसम|हवामान|तापमान|मौसाम|"
    r"\bmausam\b|\bmausam\b|\bhavaamaan\b|\bhava man\b|\btapmaan\b|\btemp\b",
    re.IGNORECASE,
)

# Safety/travel vocabulary ("is it safe to go / travel") in Hinglish.
SAFETY_MULTILINGUAL_RE = re.compile(
    r"सुरक्षित|जाऊ\s*शकतो|जा\s*सकते|सफर|यात्रा|"
    r"\bsurakshit\b|\bsafe\b|\bja\s*sakat\b|\bsafar\b|\byatra\b|\bjana\b|\bchalein\b",
    re.IGNORECASE,
)

# Alert/warning vocabulary in Hindi/Marathi.
ALERT_MULTILINGUAL_RE = re.compile(
    r"चेतावनी|अलर्ट|इशारा|अॅलर्ट|"
    r"\bchetavani\b|\balert\b|\bwarning\b",
    re.IGNORECASE,
)


def _has_devanagari(text: str) -> bool:
    return bool(re.search(r"[\u0900-\u097F]", text))


# --- English timeframe patterns (order matters: more specific first) -------- #
TIMEFRAME_PATTERNS: list[tuple[str, Timeframe, str]] = [
    (r"\bright now\b|\bcurrently\b|\bnow\b|\bat the moment\b|\bpresent\b", "now", "matched now-keywords"),
    (r"\btomorrow\b|\btmrw\b|\bnext morning\b", "tomorrow", "matched tomorrow-keywords"),
    (r"\btoday\b|\bthis morning\b|\bthis evening\b|\btonight\b", "today", "matched today-keywords"),
    (
        r"\byesterday\b|\bthe day before yesterday\b|\blast (?:night|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b",
        "past",
        "matched past-keywords",
    ),
    (r"\bthis week\b|\bnext week\b|\bthis weekend\b|\bnext weekend\b", "specific_day", "matched week/weekend"),
]

DATE_IN_TEXT = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")

# --- location patterns ------------------------------------------------------ #
LOCATION_PATTERNS = [
    # U3 (highest priority): "what/how about <place>" and "<place> <postposition>" in
    # Hindi/Marathi/Hinglish. These are checked BEFORE the generic English preposition rule so
    # a tight, specific match wins over a loose "to <verb>" capture ("safe to travel in Mumbai").
    re.compile(r"\b(?:what|how)\s+about\s+([a-z\u0900-\u097F][a-z0-9\u0900-\u097F'.,\s-]{1,50}?)\s*(?:[?.!]|$)",
               re.I),
    # Hinglish "<place> mein/mei/ka/...". Capture the SINGLE word immediately before the
    # postposition (the place token), regardless of word order, so "baarish hogi mumbai mei",
    # "mumbai mein", "kya ... mumbai mei?" all extract "mumbai" — not the preceding verbs.
    re.compile(r"\b([a-z][a-z0-9.'-]{0,39})\s+(?:mein|mei|men|mai|madhe|madhye|me|ka|ki|ke|chya|cha|che)\b",
               re.I),
    re.compile(r"([\u0900-\u097F]{2,20}?)(?:त|मध्ये|चे|चा|च्या|ला|मधले|मधला)(?![\u0900-\u097F])"),
    re.compile(r"([\u0900-\u097F]{2,20})\s+में(?![\u0900-\u097F])"),
    re.compile(r"\b(?:in|at|for|near|around|over)\s+([a-z\u0900-\u097F][a-z0-9\u0900-\u097F'.,\s-]{1,50}?)"
               r"\s*(?:right now|currently|tomorrow|today|tonight|this evening|this morning|now|[?.!]|$)", re.I),
    # "travel/go/commute/move/head TO <place>" — the place follows the travel verb + "to".
    re.compile(r"\b(?:travel|go|going|commute|commuting|drive|driving|head|heading|move|moving|fly|flying|trip to)\s+to\s+"
               r"([a-z][a-z0-9'.,\s-]{1,50}?)\s*(?:right now|currently|tomorrow|today|tonight|tomorrow|[?.!]|$)",
               re.I),
    re.compile(r"\bweather (?:in|at|for|of)\s+([a-z\u0900-\u097F][a-z0-9\u0900-\u097F'.,\s-]{1,50}?)"
               r"\s*(?:tomorrow|today|right now|currently|this week|[?.!]|$)", re.I),
    re.compile(r"\ballert[s]? (?:in|for|at|issued for)\s+([a-z\u0900-\u097F][a-z0-9\u0900-\u097F'.,\s-]{1,50}?)"
               r"\s*(?:today|right now|now|[?.!]|$)", re.I),
    re.compile(r"\b(?:rain|raining|snow|temperature|heat|humidity|wind) (?:in|at|for)\s+"
               r"([a-z\u0900-\u097F][a-z0-9\u0900-\u097F'.,\s-]{1,50}?)\s*(?:,|[?.!]|$)", re.I),
]

FILLER = re.compile(
    r"\b(any|an?|the|weather|forecast|conditions?|please|tell me|what'?s|what is|how is|is there|do you know)\b",
    re.I,
)

# Lead-in words that a multilingual capture can pick up BEFORE the real place; stripped from
# the front of a captured phrase. (Hinglish "kal"=tomorrow/yesterday, "aaj"=today, "kya"=what.)
_LEAD_IN = re.compile(
    r"^\s*(?:what|how|about|and|is|are|will|should|can|kya|kyaa|kal|aaj|aj|abhi|उद्या|आज|कल|क्या|बारिश|पाऊस|मौसम|हवामान|में|मे|के|का|की)\b\s*",
    re.IGNORECASE,
)

# Common Indian place names written in Devanagari/Hinglish -> the Latin name the geocoder
# indexes. Query understanding only: this maps a SCRIPT/ALIAS, it never invents a location.
_PLACE_ALIASES: Dict[str, str] = {
    # Devanagari -> Latin
    "मुंबई": "Mumbai", "मुम्बई": "Mumbai", "मुंबईचे": "Mumbai", "पुणे": "Pune",
    "पुण्या": "Pune", "पुण्याचे": "Pune", "दिल्ली": "Delhi", "दिल्लीत": "Delhi",
    "मुंबईत": "Mumbai", "पुण्यात": "Pune",
    "नवी दिल्ली": "New Delhi", "नई दिल्ली": "New Delhi", "बेंगळुरू": "Bengaluru",
    "बेंगलोर": "Bengaluru", "बंगलोर": "Bengaluru", "कोलकाता": "Kolkata",
    "चेन्नई": "Chennai", "हैदराबाद": "Hyderabad", "अहमदाबाद": "Ahmedabad",
    "नागपुर": "Nagpur", "जयपुर": "Jaipur", "लखनऊ": "Lucknow", "सूरत": "Surat",
    "भोपाल": "Bhopal", "इंदौर": "Indore", "पटना": "Patna", "चंडीगढ़": "Chandigarh",
    "मणाली": "Manali", "गोवा": "Goa", "नासिक": "Nashik", "नाशिक": "Nashik",
    "ठाणे": "Thane", "थाणे": "Thane", "शिमला": "Shimla", "ऋषिकेश": "Rishikesh",
    "वाराणसी": "Varanasi", "केरळ": "Kerala", "केरल": "Kerala", "महाराष्ट्र": "Maharashtra",
    "गुजरात": "Gujarat", "राजस्थान": "Rajasthan", "पंजाब": "Punjab",
    # Hinglish Latin spellings -> canonical
    "mumbai": "Mumbai", "bombay": "Mumbai", "pune": "Pune", "poona": "Pune",
    "delhi": "Delhi", "nayi dilli": "New Delhi", "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru", "calcutta": "Kolkata", "kolkata": "Kolkata",
    "madras": "Chennai", "chennai": "Chennai", "hyderabad": "Hyderabad",
    "ahmedabad": "Ahmedabad", "nagpur": "Nagpur", "jaipur": "Jaipur",
}


def _normalize_place(raw: str) -> Optional[str]:
    """Strip lead-ins/filler and map a Devanagari/Hinglish place to its canonical Latin name.
    Returns None if nothing place-like remains (caller then treats it as 'no location')."""
    s = raw.strip(" .,?'\"")
    # Repeatedly peel lead-in words (handles "kya kal mumbai ...").
    for _ in range(4):
        new = _LEAD_IN.sub("", s).strip(" .,?'\"")
        if new == s:
            break
        s = new
    s = FILLER.sub(" ", s)
    # Time/date words are NOT places ("what about tomorrow?" must not yield location=tomorrow).
    s = re.sub(
        r"\b(tomorrow|tmrw|today|tonight|right now|currently|now|yesterday|this week|next week)\b",
        " ", s, flags=re.I,
    )
    s = re.sub(r"(कल|उद्या|आज|अभी|बीता\s+कल)", " ", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" .,?'\"")
    if not s:
        return None
    # Direct alias (whole phrase, case-insensitive for Latin).
    key = s.strip()
    if key in _PLACE_ALIASES:
        return _PLACE_ALIASES[key]
    low = key.lower()
    if low in _PLACE_ALIASES:
        return _PLACE_ALIASES[low]
    # A loose preposition capture can grab a verb/activity ("safe to travel"). These are never
    # place names — reject so a later, tighter pattern can win (and we never geocode a verb).
    _NON_PLACE = {
        "travel", "go", "going", "commute", "commuting", "drive", "driving", "walk", "walk",
        "safe", "rain", "rainfall", "raining", "snow", "wind", "weather", "forecast", "alert",
        "alerts", "trip", "fishing", "marine", "it", "me", "us", "tomorrow", "today", "now",
        "there", "here", "out", "outside", "home", "work",
    }
    if low in _NON_PLACE:
        return None
    # If the phrase ENDS in a trailing non-place token from a loose capture ("travel in Mumbai"
    # is already handled by tighter patterns), guard the first token too.
    first = low.split()[0] if low.split() else ""
    if first in _NON_PLACE and len(low.split()) == 1:
        return None
    # If the phrase is entirely Devanagari and we don't have an alias, transliteration-free we
    # cannot geocode reliably -> return None (clarify) rather than guess a wrong city.
    if _has_devanagari(key) and not re.search(r"[A-Za-z]", key):
        # Try a prefix match against known aliases (e.g. "मुंबईत" stem already suffix-stripped).
        for dev, latin in _PLACE_ALIASES.items():
            if key.startswith(dev) or dev.startswith(key):
                return latin
        return None
    return s


def extract_timeframe(text: str, today: Optional[dt.date] = None) -> tuple[Timeframe, str, Optional[str]]:
    """`today` is accepted only for tests; production timeframes stay relative strings so the
    location's own timezone decides which calendar day "tomorrow" means."""
    t = text.lower()
    m = DATE_IN_TEXT.search(t)
    if m:
        # An explicit calendar date is the ONLY case where we pin target_date here: the
        # backend must not re-derive "today" from the SERVER clock (UTC) because the user's
        # city runs on its own clock. Live bug found in Phase 1 testing: "tomorrow" was
        # resolved to the UTC date and silently queried today.
        return "specific_day", "matched explicit YYYY-MM-DD date", m.group(1)
    for pattern, label, reason in TIMEFRAME_PATTERNS:
        if re.search(pattern, t):
            return label, reason, None
    # U3: Hindi/Marathi/Hinglish timeframe words ("kal", "aaj", "उद्या", "आज", ...).
    for pattern, label, reason in TIMEFRAME_PATTERNS_MULTILINGUAL:
        if re.search(pattern, t):
            return label, reason, None
    return "unspecified", "no explicit timeframe word found", None


def extract_location(text: str) -> tuple[Optional[str], str]:
    """Return (place_phrase, reason). We never guess a city if the pattern misses."""
    # Dates are timeframe evidence, never part of a place name. Without this, "weather in
    # Ahmedabad on 2026-08-25" captured "ahmedabad on 2026" and failed geocoding (live bug,
    # found by running the pipeline).
    text = DATE_IN_TEXT.sub(" ", text)
    text = re.sub(r"\b(?:on|of|for)?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?", "", text, flags=re.I)
    # Try each pattern in priority order; the first whose capture normalises to a real place
    # wins. A capture that reduces to nothing (e.g. only a timeframe word) is skipped, so we
    # never return a non-place as a location.
    for i, pattern in enumerate(LOCATION_PATTERNS):
        m = pattern.search(text)
        if not m:
            continue
        raw = m.group(1).strip(" .,?'\"")
        cleaned = _normalize_place(raw)
        if cleaned:
            return cleaned, f"pattern#{i + 1} preposition/keyword capture"
    return None, "no location pattern matched"


def classify_intent(
    text: str, timeframe: Timeframe, today: Optional[dt.date] = None, target_date: Optional[str] = None
) -> tuple[str, str]:
    """
    Phase 1 keyword router. Returns (intent, reason).
    Replace the body with a call to the mBERT+LoRA service when it is a callable function;
    keep this signature so nothing else changes.
    """
    t = text.lower()
    if re.search(r"\balert[s]?\b|\bwarning[s]?\b|\bwatch\b|\balarm\b|\bSACHET\b|\bIMD warning\b", t) \
            or ALERT_MULTILINGUAL_RE.search(text):
        return "official_alert", "matched alert/warning keywords (incl. Hindi/Marathi)"
    if re.search(
        r"\bsafe\b|\bshould i\b|\bcan i\b|\brisk\b|\btravel\b|\bcommut\w*\b|\bdrive\b|\bouting\b"
        r"\bflights?\b|\bplan(e|es)? a\b|\bcancel\w*\b|\bpickleball\b|\bmarathon\b|\boutdoor\b",
        t,
    ) or SAFETY_MULTILINGUAL_RE.search(text):
        return "advisory_risk", "matched travel/safety/activity keywords (incl. Hindi/Marathi)"
    # An explicit PAST date is a historical question even if the wording says "weather in".
    is_past_date = False
    if target_date:
        try:
            is_past_date = dt.date.fromisoformat(target_date) < (today or dt.date.today())
        except ValueError:
            is_past_date = False
    if timeframe == "past" or is_past_date or re.search(
        r"\bhistor\w+\b|\bclimate\b|\baverage\b|\bnormals?\b|\byesterday\b|\blast year\b|\bprevious\b", t
    ):
        return "historical_climate", "matched historical/climate keywords or past timeframe"
    if re.search(r"\?.*$", t) or re.search(
        r"\bweather\b|\bforecast\b|\btemperature\b|\brain\b|\bsnow\b|\bwind\b|\bhumid\w*\b", t
    ) or RAIN_MULTILINGUAL_RE.search(text) or WEATHER_MULTILINGUAL_RE.search(text):
        return "forecast_current", "matched weather/forecast vocabulary (incl. Hindi/Marathi)"
    return "clarification_needed", "no weather signal found in the message"


def classify_topic(text: str, intent: str = "") -> str:
    """U3: fine-grained practical topic for the conversational layer / UI. Pure query
    understanding — it NEVER produces weather values or risk; those come from the pipeline.
    Returns one of QueryTopic."""
    t = text.lower()
    # order matters: practical/rain specifics before the generic weather bucket
    if re.search(r"\bumb?rella\b|\brain[\s-]?coat\b|\bgaloshes?\b", t) \
            or re.search(r"छाता|छत्री|रेनकोट", text):
        return "umbrella_advice"
    if re.search(r"\balert|warning|watch\b", t) or ALERT_MULTILINGUAL_RE.search(text):
        return "official_alert"
    if re.search(r"\bhistor|climate|average|normal|yesterday|last year|previous\b", t):
        return "historical_climate"
    if re.search(r"\b(?:safe|should i go|can i go|travel|commute|drive|trip|flight|train|go out)\b", t) \
            or SAFETY_MULTILINGUAL_RE.search(text):
        return "travel_safety"
    if re.search(r"\b(?:picnic|outdoor|outing|marathon|sports?|game|cycl|hike|trek|beach|park|play)\b", t):
        return "outdoor_suitability"
    if re.search(r"\b(?:rain|rainfall|shower|drizzl|precip|storm|thunder|wet)\b", t) \
            or RAIN_MULTILINGUAL_RE.search(text):
        return "rain_prediction"
    if re.search(r"\b(?:temperature|hot|cold|warm|chilly|heat|degree|°c?\b|freezing|humid)\b", t) \
            or re.search(r"तापमान|गर्मी|ठंड", text):
        return "temperature"
    if intent == "official_alert":
        return "official_alert"
    if intent == "historical_climate":
        return "historical_climate"
    if intent == "advisory_risk":
        return "travel_safety"
    if re.search(r"\b(weather|forecast|condition|mausam|मौसम|हवामान)\b", t) or WEATHER_MULTILINGUAL_RE.search(text):
        return "weather_summary"
    return "other"


def parse(text: str, today: Optional[dt.date] = None) -> ParsedQuery:
    text = (text or "").strip()
    timeframe, tf_reason, target_date = extract_timeframe(text, today=today)
    location, loc_reason = extract_location(text)
    intent, intent_reason = classify_intent(text, timeframe, today=today, target_date=target_date)
    notes = [f"location: {loc_reason}", f"timeframe: {tf_reason}"]
    if location is None:
        notes.append("no place name found in the message -> caller must ask for clarification")
        if intent != "advisory_risk":
            intent = "clarification_needed"
            intent_reason = "location missing"
    # Fine-grained conversational topic (query understanding only; not a risk input). Computed
    # from the raw message so it survives the location-missing intent override above; the
    # context resolver carries the topic across follow-ups.
    topic = classify_topic(text, intent=intent if intent != "clarification_needed" else "")
    return ParsedQuery(
        message=text,
        intent=intent,  # type: ignore[arg-type]
        intent_reason=intent_reason,
        topic=topic,  # type: ignore[arg-type]
        location_text=location,
        timeframe=timeframe,  # type: ignore[arg-type]
        timeframe_reason=tf_reason,
        target_date=target_date,
        notes=notes,
    )


# ---- U4: response-language detection -------------------------------------- #
# The user's chosen voice/UI language is the primary signal; the message text is
# the fallback (auto-detect when the caller did not pass an explicit choice).
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
# Strong Marathi-only cues (vs. Hindi which shares the Devanagari script).
_MR_CUES = re.compile(r"पडेल का|पाऊस पड|कसे आहे|आहे का|सांगा|तपासू|सध्या|उद्या")
# Romanized colloquial Hindi markers -> "hinglish" (answer in the same Roman style).
_HINGLISH_MARKERS = re.compile(
    r"\b(kya|hai|hain|kal|aaj|baarish|barish|barasat|mausam|jaldi|karega|hogi|hoga|"
    r"chahiye|chahie|mein|me|ka|ki|ke|nahi|nahin|batao|bata|sunao|accha|thik|karo|"
    r"lagta|lagti|dekh|dekhna|pucho|hai\?)\b",
    re.IGNORECASE,
)


def detect_response_language(text: Optional[str], explicit: Optional[str] = None) -> str:
    """Which language the assistant should answer in for this turn.

    An explicit UI/voice choice (``en|hi|mr|hinglish``) always wins. Otherwise we infer it
    from the message: Devanagari -> Hindi (Marathi only when strong Marathi cues are
    present), Romanized Hindi markers -> Hinglish, else English. This is a presentation
    decision; weather values/numbers are always preserved verbatim.
    """
    choices = {"en", "hi", "mr", "hinglish"}
    if explicit and explicit.strip().lower() in choices:
        return explicit.strip().lower()
    t = (text or "").strip()
    if not t:
        return "en"
    if _DEVANAGARI.search(t):
        return "mr" if _MR_CUES.search(t) else "hi"
    if _HINGLISH_MARKERS.search(t.lower()):
        return "hinglish"
    return "en"
