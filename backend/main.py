"""
main.py — FastAPI app: the pipeline from the pitch, in code.

USER QUERY -> parse (intent/location/timeframe) -> geocode -> retrieve weather evidence
          -> retrieve NDMA SACHET alerts (concurrent)
          -> validate (evidence sanity) -> quality (Evidence Quality) -> advise (deterministic risk)
          -> llm (Groq explains the decided evidence) -> grounding (verify every claim in it)
          -> answer + source + timestamp (+ badge, + alert)  or  graceful abstain / clarify

Phase 4 order matters twice over: advisory fixes the risk level BEFORE any sentence is written, and
grounding runs AFTER the model, so the LLM is a voice for the evidence rather than a source of it.
A missing key, a timeout or a hallucination changes the wording's origin, never the answer's right
to exist: every failure path ends in the deterministic evidence-based sentence.

Phase 3 order matters: quality reads the Validation object, and advisory reads both. That is why
the LLM can never be the one deciding whether something is safe — by the time a sentence is
written, risk_level and evidence_quality are already fixed facts in the evidence payload.

Run:  uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import datetime as dt
import pathlib
from typing import Any, Dict

import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import config
from backend.models import (
    Evidence,
    GeocodeResult,
    ParsedQuery,
    QueryRequest,
    QueryResponse,
    ResolvedLocation,
)
from backend.services import alerts as alerts_service
from backend.services import advisory as advisory_service
from backend.services import climate as climate_service
from backend.services import context
from backend.services import evidence as evidence_service
from backend.services import geocoding, parsing, weather
from backend.services import llm as llm_service
from backend.services import providers
from backend.services import quality as quality_service
from backend.services import validation
from backend.services.http_client import UpstreamError

APP_VERSION = "0.5.0-u1"  # P1 retrieval · P2 SACHET alerts · P3 validation+quality+advisory · P4 grounded LLM · P5A provider registry · U1 disaster scenarios + official alert UX

app = FastAPI(
    title="WeatherGPT MVP",
    description="Grounded conversational weather intelligence layer — retrieval, validation and abstention; the LLM never becomes the source of meteorological truth.",
    version=APP_VERSION,
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# The React frontend lives in frontend/ and builds to frontend/dist/ (vite build). In production
# FastAPI serves the BUILT app from dist: API routes are declared first, then a SPA catch-all
# returns index.html for client routes and StaticFiles serves the hashed assets. During frontend
# development (npm run dev on :5173) Vite proxies /api and /health here, so nothing is served here.
FRONTEND_DIR = pathlib.Path(__file__).resolve().parent.parent / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"


def _has_built_app() -> bool:
    return (FRONTEND_DIST / "index.html").is_file()


if _has_built_app():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/", include_in_schema=False)
async def index():
    """Serves the built React app when frontend/dist exists; otherwise a JSON service banner."""
    target = FRONTEND_DIST / "index.html"
    if target.is_file():
        return FileResponse(str(target))
    return {
        "service": f"WeatherGPT MVP ({APP_VERSION}) - grounded weather intelligence API",
        "frontend": "not built yet — run `npm install && npm run build` in frontend/ (or `npm run dev` and use the Vite proxy)",
        "read_this_first": "GET /api/pipeline?message=What is the weather in Nagpur right now?",
        "endpoints": {
            "POST /api/query": "natural-language question -> status + Evidence (weather + SACHET alerts)",
            "GET /api/pipeline": "same, as a GET, with the stage-by-stage trace (easiest in a browser)",
            "GET /api/overview": "read-only current-conditions summary for the dashboard map",
            "GET /api/climate": "multi-year trends from the Open-Meteo ARCHIVE (research/repro, not IMD)",
            "POST /api/advisory": "sector-specific deterministic advisory for a place/activity",
            "GET /api/alerts": "alerts only: ?place=Mayurbhanj&context=Odisha",
            "GET /api/geocode": "place resolution + ambiguity handling",
            "GET /api/weather": "raw provider block for given coordinates",
            "GET /health": "provider, alert config, active demo simulations",
            "GET /docs": "OpenAPI (Swagger) UI",
        },
    }





@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "weather_provider": config.WEATHER_PROVIDER,
        # Phase 5A: the full provider registry (live + architecture-ready stubs), secret-free.
        "weather_providers": providers.providers_report(config.WEATHER_PROVIDER),
        # Phase 4: exactly three fields, no secret. `configured` is the only thing another
        # machine needs to know about the key's existence.
        "llm": {
            "configured": bool(config.GROQ_API_KEY) and config.LLM_ENABLED,
            "provider": "groq",
            "model": config.GROQ_MODEL,
        },
        "alerts": {
            "enabled": config.SACHET_ENABLED,
            "source": "NDMA SACHET (CAP/RSS)",
            "feeds_base": config.SACHET_RSS_BASE,
            "max_age_h": config.ALERT_MAX_AGE_H,
            "detail_limit": config.ALERT_DETAIL_LIMIT,
            "fixture_rss": config.ALERT_FIXTURE_RSS or None,
        },
        "phase3": {
            "validation": "active",
            "quality_weights": quality_service.WEIGHTS,
            "advisory_thresholds": {k: v[0] for k, v in advisory_service.THRESHOLDS.items()},
            "threshold_units": "documented engineering heuristics, not IMD criteria",
        },
        "simulations": {
            "weather_failure": config.SIMULATE_WEATHER_FAILURE,
            "stale_data": config.SIMULATE_STALE_DATA,
            "alert_failure": config.SIMULATE_ALERT_FAILURE,
            "latency_ms": config.SIMULATE_LATENCY_MS,
        },
        "utc_now": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }


_COORDS_HINT = re.compile(
    r"^\s*(?P<lat>-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(?P<lon>-?\d{1,3}(?:\.\d+)?)\s*$"
)


def _localized_clarification(lang: str | None) -> str:
    """U4: conversational 'ask for a location' question in the user's response language."""
    if lang == "hi":
        return "कौन से शहर का मौसम जाँचूँ? कृपया शहर या ज़िले का नाम बताएँ।"
    if lang == "mr":
        return "कोणत्या शहराचे हवामान तपासू? कृपया शहर किंवा जिल्ह्याचे नाव सांगा."
    if lang == "hinglish":
        return "Kaun se sheher ka mausam check karun? Please ek city ya district ka naam do."
    return "Which location should I check? Please give me a city or district name."


def _coords_from_hint(location_hint: str | None) -> tuple[float, float] | None:
    """A browser geolocation fix is passed as 'lat,lon' (or 'lat lon'). Used ONLY when the
    message names no place; a place the user typed always wins over coordinates."""
    if not location_hint:
        return None
    m = _COORDS_HINT.match(location_hint)
    if not m:
        return None
    lat, lon = float(m.group("lat")), float(m.group("lon"))
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return lat, lon
    return None


async def run_pipeline(
    message: str,
    location_hint: str | None = None,
    activity: str | None = None,
    coordinates: tuple[float, float] | None = None,
    session_id: str | None = None,
    conversational: bool = True,
    language: str | None = None,
) -> tuple[Evidence, Dict[str, Any]]:
    """Shared by /api/query and the phase-1 test script, so tests exercise the real path.

    U3: ``session_id`` + ``conversational=True`` enable the controlled conversation-context
    layer (Chat/Voice turns). Context fills ONLY the slots a new message leaves blank
    (location/timeframe/intent/activity/topic) from the previous *resolved* turn. It never
    injects raw history into the LLM — the model still receives exactly one structured Evidence
    object. Background UI data-sync calls pass ``conversational=False``: they neither read nor
    write session memory, so the active conversation is never disturbed. See context.py.

    U4: ``language`` (the UI/voice-selected en/hi/mr/hinglish) sets the response language; if
    absent it is auto-detected from the message. It is placed inside ``ev.request`` as
    ``response_language`` (structured metadata, not a separate prompt), so the LLM/fallback
    answers in that language and the frontend speaks it with the matching TTS voice.
    """
    # The language choice applies to the raw message; an explicit UI choice wins over detection.
    effective_language = parsing.detect_response_language(message, language)
    trace: Dict[str, Any] = {"stages": []}

    def stage(name: str, status: str, detail: Dict[str, Any]) -> None:
        trace["stages"].append({"stage": name, "status": status, **detail})

    parsed: ParsedQuery = parsing.parse(message, today=dt.date.today())

    # ---- U3: conversation-context resolution (structured slots only, no raw history) ---- #
    prior_ctx = context.STORE.get(session_id) if (session_id and conversational) else None
    if conversational:
        turn = context.resolve_turn(parsed, prior_ctx)
    else:
        # Background/non-conversational request: resolve nothing from memory, inherit nothing.
        turn = context.ResolvedTurn(parsed=parsed, context_used={}, carried_location=False)
    context_carried: Dict[str, str] = dict(turn.context_used)
    # A remembered RESOLVED location lets us skip geocoding entirely for follow-ups ("there").
    remembered_location = prior_ctx.location if (prior_ctx and turn.carried_location) else None
    # An explicit activity on the request always wins; otherwise the prior topic carries over.
    effective_activity = activity or (prior_ctx.activity if prior_ctx else None)
    stage(
        "parse",
        "clarify" if turn.needs_clarification else "ok",
        {
            "intent": turn.parsed.intent,
            "intent_reason": turn.parsed.intent_reason,
            "topic": turn.parsed.topic,
            "location_text": turn.parsed.location_text,
            "timeframe": turn.parsed.timeframe,
            "timeframe_reason": turn.parsed.timeframe_reason,
            "notes": turn.parsed.notes,
            "session_id": session_id or None,
            "context_used": context_carried,
            "context_turn": prior_ctx.turn_count if prior_ctx else 0,
        },
    )
    parsed = turn.parsed

    # A reference with no antecedent (e.g. "Is it safe to travel?" as the very first CONVERSATIONAL
    # message): ask instead of guessing a location. Background (non-conversational) calls always
    # carry an explicit place/coordinates and never trigger this conversational clarification.
    if conversational and turn.needs_clarification and remembered_location is None \
            and coordinates is None and _coords_from_hint(location_hint) is None:
        ev = Evidence(
            status="clarify",
            request={"message": message, "intent": parsed.intent, "timeframe": parsed.timeframe,
                     "topic": getattr(parsed, "topic", "other"),
                     "response_language": effective_language},
            clarification=_localized_clarification(effective_language),
            evidence_quality="LOW",
            validation={"sufficient": False, "location_resolved": False,
                        "failures": ["missing_location"]},
        )
        ev.quality_breakdown = {"reason": "follow-up reference had no prior location in this session"}
        trace["conversation"] = {"session_id": session_id or None, "context_used": context_carried,
                                 "clarified": True}
        stage("abstain_or_clarify", "clarify", {"why": "missing_location_no_context"})
        return ev, trace

    # ADDITIVE: browser geolocation coordinates are honoured only when the message names no
    # place. A typed place always goes through the normal geocoder (no coordinates spoofing).
    # U3: a follow-up that reuses a remembered, already-resolved place ("there", "is it safe?")
    # skips geocoding entirely — we answer for the identical coordinates we verified last turn.
    if remembered_location is not None:
        geo = GeocodeResult(
            status="ok",
            query=remembered_location.name,
            location=remembered_location,
            clarification=None,
        )
        stage(
            "geocode",
            "ok",
            {
                "query": remembered_location.name,
                "location": remembered_location.model_dump(),
                "candidates": [],
                "clarification": None,
                "gap": None,
                "reused_from_conversation": True,
            },
        )
    else:
        coords = _coords_from_hint(location_hint) or coordinates
        if coords is not None and not parsed.location_text:
            geo = GeocodeResult(
                status="ok",
                query="device location",
                location=ResolvedLocation(
                    name="Your current location",
                    latitude=coords[0],
                    longitude=coords[1],
                    resolution_note="resolved from browser geolocation coordinates (no place name in the query)",
                ),
                clarification=None,
            )
            stage("geocode", "ok", {"query": "device location", "location": geo.location.model_dump(),
                                    "candidates": [], "clarification": None, "gap": None})
        else:
            geo = await geocoding.resolve(parsed.location_text, context=location_hint)
            stage(
                "geocode",
                geo.status,
                {
                    "query": geo.query,
                    "location": geo.location.model_dump() if geo.location else None,
                    "candidates": [c.model_dump() for c in geo.candidates],
                    "clarification": geo.clarification,
                    "gap": geo.evidence_gap,
                },
            )

    # ---- short-circuit: clarify / unresolved, with NO weather retrieved ---- #
    if geo.status == "ambiguous":
        ev = Evidence(
            status="clarify",
            request={"message": parsed.message, "intent": parsed.intent, "timeframe": parsed.timeframe,
                     "topic": getattr(parsed, "topic", "other"),
                     "response_language": effective_language},
            clarification=geo.clarification or _localized_clarification(effective_language),
            evidence_quality="LOW",
            validation={"sufficient": False, "failures": ["ambiguous_location"]},
        )
        ev.quality_breakdown = {"reason": "location not uniquely resolved"}
        stage("abstain_or_clarify", "clarify", {"why": "ambiguous_location"})
        return ev, trace

    if geo.status in {"unresolved", "error"} or geo.location is None:
        # No place named at all -> that is a question, not a data failure: ask.
        if geo.evidence_gap == "missing_location":
            ev = Evidence(
                status="clarify",
                request={"message": parsed.message, "intent": parsed.intent, "timeframe": parsed.timeframe,
                         "topic": getattr(parsed, "topic", "other"),
                         "response_language": effective_language},
                clarification=geo.clarification or _localized_clarification(effective_language),
                evidence_quality="LOW",
                validation={"sufficient": False, "location_resolved": False, "failures": ["missing_location"]},
            )
            ev.quality_breakdown = {"reason": "no location in the question"}
            stage("abstain_or_clarify", "clarify", {"why": "missing_location"})
            return ev, trace
        ev = Evidence(
            status="abstain",
            request={"message": parsed.message, "intent": parsed.intent, "timeframe": parsed.timeframe,
                     "topic": getattr(parsed, "topic", "other"),
                     "response_language": effective_language},
            evidence_quality="LOW",
            abstain_reason=(
                f"I couldn\u2019t verify a real location for \u201c{geo.query or 'that place'}\u201d, "
                "so I won\u2019t guess weather data for it."
            ),
            validation={
                "sufficient": False,
                "location_resolved": False,
                "failures": [geo.evidence_gap or "unresolved_location"],
            },
        )
        ev.quality_breakdown = {"reason": "no verified coordinates"}
        stage("abstain_or_clarify", "abstain", {"why": geo.evidence_gap or "unresolved_location"})
        return ev, trace

    loc = geo.location

    # ---- U3: remember this turn's RESOLVED slots for the next message in THIS session ---- #
    # Only the small structured context is stored (place + coords + timeframe + intent +
    # activity). Raw chat text is never stored and never reaches the LLM. A turn that failed to
    # geocode never reaches here, so memory only ever contains verified places. Only
    # CONVERSATIONAL turns (Chat/Voice) touch the store; background sync calls are excluded.
    if session_id and conversational:
        context.STORE.put(
            session_id,
            location_text=parsed.location_text or loc.name,
            location=loc,
            timeframe=parsed.timeframe,
            target_date=parsed.target_date,
            intent=parsed.intent if parsed.intent != "clarification_needed" else None,
            topic=parsed.topic,
            activity=effective_activity,
        )
        trace["conversation"] = {
            "session_id": session_id,
            "context_used": context_carried,
            "remembered": {"location": loc.name, "timeframe": parsed.timeframe,
                           "intent": parsed.intent, "topic": parsed.topic,
                           "activity": effective_activity},
        }

    # ---- retrieve live evidence (weather + official alerts, concurrently) ---- #
    # Concurrent on purpose: the SACHET round-trips must not add latency to the demo, and a
    # slow/blocked alert feed must never delay or break the weather answer (they fail alone).
    async def _weather_task():
        return await weather.get_provider().fetch(
            loc.latitude,
            loc.longitude,
            timeframe=parsed.timeframe,  # type: ignore[arg-type]
            timezone=loc.timezone,
            target_date=parsed.target_date,
            utc_offset_seconds=loc.utc_offset_seconds,
        )

    async def _alerts_task():
        return await alerts_service.check_alerts(loc)

    weather_error: str | None = None
    bundle = None
    alerts_result = None
    alerts_error: str | None = None
    try:
        bundle, alerts_result = await asyncio.gather(_weather_task(), _alerts_task())
        stage(
            "retrieve_weather",
            "ok",
            {
                "provider": bundle.provider,
                "kind": bundle.kind,
                "retrieved_at_utc": bundle.retrieved_at_utc,
                "current_time": bundle.current.time if bundle.current else None,
                "request_url": bundle.request_url,
            },
        )
    except UpstreamError as exc:
        # Weather failed: do NOT let a partial alert result look like a complete answer.
        weather_error = f"{exc.service}: {exc.detail}"
        stage("retrieve_weather", "error", {"detail": weather_error})
        alerts_result, alerts_error = None, "not consulted (weather retrieval failed first)"

    if not alerts_error and alerts_result is not None and alerts_result.state == "unavailable":
        alerts_error = alerts_result.error or "SACHET unavailable"

    ev = evidence_service.build_evidence(parsed, geo, bundle, alerts_result,
                                     response_language=effective_language)
    if weather_error:
        ev.status = "abstain"
        ev.abstain_reason = (
            "Reliable weather data could not be verified right now "
            f"(upstream weather source failed: {weather_error}). "
            "I will not invent numbers."
        )
        ev.evidence_quality = "LOW"
        ev.validation.sufficient = False
        ev.validation.failures.append("weather_retrieval_failed")
        ev.quality_breakdown = {"reason": "evidence retrieval failed"}

    if alerts_result is not None:
        stage(
            "retrieve_alerts",
            alerts_result.state,
            {
                "source": alerts_result.source,
                "authority": alerts_result.authority,
                "mode": alerts_result.mode,
                "feeds_considered": alerts_result.feeds_considered,
                "items_in_feeds": alerts_result.items_in_feeds,
                "details_fetched": alerts_result.details_fetched,
                "relevant": len(alerts_result.items),
                "rejected_duplicate": alerts_result.rejected_duplicate,
                    "rejected_not_relevant": alerts_result.rejected_not_relevant,
                "rejected_uncertain": alerts_result.rejected_uncertain,
                "rejected_stale": alerts_result.rejected_stale,
                "expired_seen": len(alerts_result.recent_expired),
                "duration_ms": alerts_result.duration_ms,
                "error": alerts_result.error,
                "notes": alerts_result.notes,
            },
        )
        # Alert QUESTION + unconsultable source => the answer cannot be complete. Phase 3 turns
        # this into LOW/abstain; we record it now so the decision is data, not improvisation.
        if parsed.intent == "official_alert" and alerts_result.state != "checked":
            ev.quality_breakdown["alert_intent_blocker"] = alerts_result.error or "alerts_not_checked"
            ev.validation.warnings.append(
                "the question was about official alerts but the alert source could not be "
                "consulted; any 'no alert' wording would be unsupported"
            )
    elif alerts_error:
        stage("retrieve_alerts", "skipped", {"reason": alerts_error})

    stage(
        "evidence",
        "ok" if ev.status == "grounded" else ev.status,
        {
            "sources": [s.model_dump() for s in ev.sources],
            "validation": ev.validation.model_dump(),
            "alert_state": ev.alert_state,
            "alert_relevance": [
                {
                    "alert_id": a.alert_id,
                    "validity": a.validity,
                    "relevance": a.relevance.status,
                    "level": a.relevance.level,
                    "reason": a.relevance.reason,
                }
                for a in (alerts_result.items if alerts_result else [])
            ],
        },
    )
    # ---- Phase 3: validate -> Evidence Quality -> deterministic advisory ---------------- #
    # Runs for EVERY path, including the ones already marked abstain: the point is to record WHY
    # something is untrustworthy, not to hide it. Status only ever degrades from here
    # (grounded -> abstain), never the other way round.
    ev.validation = validation.validate_evidence(ev)
    stage("validate", "ok" if ev.validation.ok else "failed", validation.summary(ev.validation))

    # Insufficient evidence is an abstention, not a caveat: same rule that already applies to a
    # failed weather retrieval, now applied to stale/implausible/mislabelled data as well.
    if ev.status == "grounded" and not ev.validation.sufficient:
        ev.status = "abstain"
        ev.abstain_reason = (
            "I could not verify this evidence well enough to answer from it ("
            + "; ".join(ev.validation.failures[:3])
            + "). I will not present unverified numbers as fact."
        )
        stage("abstain_or_clarify", "abstain", {"why": "validation_insufficient"})

    label, breakdown = quality_service.score_evidence(ev, ev.validation)
    ev.evidence_quality = label  # type: ignore[assignment]
    # keep anything Phase 2 already recorded (alert_intent_blocker) — the breakdown is cumulative
    ev.quality_breakdown = {**ev.quality_breakdown, **breakdown}
    stage(
        "quality",
        label,
        {
            "score": breakdown["score"],
            "weights": breakdown["weights"],
            "components": breakdown["breakdown"],
            "caps_applied": breakdown["breakdown"]["caps_applied"],
            "notes": breakdown["notes"],
        },
    )

    ev.advisory = advisory_service.advise(ev, activity=effective_activity)
    ev.risk = ev.advisory.risk_level
    # Post-advise integrity gate: the advisory may only cite alerts that are actually in the
    # evidence. Same function Phase 4's grounding verifier will run on the LLM's answer.
    refs_ok, ref_failures = validation.advisory_references_ok(ev)
    if not refs_ok:
        ev.validation.alert_integrity = False
    ev.validation.checks_run.append("advisory_alert_references")
    if not refs_ok:
        ev.validation.failures.extend(ref_failures)
        ev.validation.ok = False
        ev.validation.sufficient = False
        if ev.status == "grounded":
            ev.status = "abstain"
            ev.abstain_reason = "The risk layer referenced an alert that is not in the verified evidence, so the answer was stopped."
    stage(
        "advise",
        ev.advisory.risk_level,
        {
            "activity": ev.advisory.activity,
            "rules_fired": ev.advisory.rules_fired,
            "factors": ev.advisory.factors,
            "cited_alerts": ev.advisory.alert_ids,
            "alert_references_ok": refs_ok,
            "headline": ev.advisory.headline,
            "reason": ev.advisory.reason,
        },
    )

    # ---- Phase 4: grounded explanation (the LLM never decides anything) -------------------- #
    # `explain()` is given exactly `ev.model_dump()` and its reply is only kept if
    # `grounding.verify()` passes. No key, dead endpoint, bad JSON or a rejected answer all land on
    # the deterministic evidence-based sentence, so this stage cannot take the product down.
    answer, report = await llm_service.explain(ev)
    if report.llm_status == "ok":
        llm_status = "ok"
    elif report.llm_status in ("disabled", "no_key", "skipped"):
        llm_status = "skipped"
    elif report.verified or answer.origin == "deterministic_fallback":
        llm_status = "fallback"
    else:
        llm_status = "failed"          # the fallback itself did not verify: a bug in this build
    stage(
        "llm",
        llm_status,
        {
            "provider": "groq",
            "model": report.model,
            "reason": report.llm_status,
            "attempts": report.attempts,
            "regenerated": report.regenerated,
            "latency_ms": report.latency_ms,
            "origin": answer.origin,
            "note": report.note,
            "prompt_chars": len(llm_service.SYSTEM_PROMPT),
            "temperature": config.LLM_TEMPERATURE,
        },
    )
    stage(
        "grounding",
        "ok" if report.verified else "failed",
        {
            "verified": report.verified,
            "checks_run": report.checks_run,
            "numbers_checked": report.numbers_checked,
            "numbers_rejected": report.numbers_rejected,
            "failures": report.failures,
            "alert_mentioned": answer.alert_mentioned,
        },
    )
    trace["answer"] = answer.model_dump()

    trace["parsed_query"] = parsed.model_dump()
    return ev, trace


@app.post("/api/query", response_model=QueryResponse)
async def query(req: QueryRequest) -> QueryResponse:
    coords = (req.latitude, req.longitude) if (req.latitude is not None and req.longitude is not None) else None
    ev, trace = await run_pipeline(
        req.message,
        location_hint=req.location_hint,
        activity=req.activity,
        coordinates=coords,
        session_id=req.session_id,
        conversational=req.conversational,
        language=req.language,
    )
    return QueryResponse(
        status=ev.status,  # type: ignore[arg-type]
        user_message=req.message,
        evidence=ev,
        pipeline=trace if req.include_pipeline else {},
        # The answer travels alongside the evidence, not inside it: `evidence` stays the object the
        # LLM was given, so a reviewer can re-run the verifier on the reply and agree with it.
        answer=trace.get("answer"),
        # U3: echo the session id so a stateless client can keep the conversation continuity.
        session_id=req.session_id,
    )


@app.post("/api/session/reset")
async def session_reset(payload: Dict[str, Any]) -> Dict[str, Any]:
    """U3: forget a conversation's context (new chat / 'clear'). The client calls this when the
    user starts a fresh conversation so no prior location/topic leaks into it."""
    sid = (payload or {}).get("session_id")
    if sid:
        context.STORE.clear(str(sid))
    return {"ok": True, "session_id": sid, "context_cleared": True}


@app.get("/api/pipeline")
async def pipeline_get(
    message: str,
    location_hint: str | None = None,
    activity: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    session_id: str | None = None,
    conversational: bool = True,
    language: str | None = None,
) -> Dict[str, Any]:
    """GET twin of /api/query — convenient for curl/PowerShell during the sprint."""
    coords = (latitude, longitude) if (latitude is not None and longitude is not None) else None
    ev, trace = await run_pipeline(
        message, location_hint=location_hint, activity=activity, coordinates=coords,
        session_id=session_id, conversational=conversational, language=language,
    )
    return {"status": ev.status, "evidence": ev.model_dump(), "pipeline": trace}


@app.post("/api/advisory")
async def advisory_only(
    message: str = "Is it safe to travel?",
    location_hint: str | None = None,
    activity: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Dict[str, Any]:
    """ADDITIVE: run the same grounded pipeline for a sector-specific advisory. The deterministic
    advisory engine is the only authority for risk; this is a convenience wrapper that returns
    evidence.advisory (plus risk/quality/sources) so the advisory page never computes risk itself."""
    coords = (latitude, longitude) if (latitude is not None and longitude is not None) else None
    ev, _trace = await run_pipeline(
        message,
        location_hint=location_hint or activity,
        activity=activity,
        coordinates=coords,
    )
    return {
        "ok": ev.status in {"grounded", "abstain", "clarify"},
        "status": ev.status,
        "risk": ev.risk,
        "activity": ev.advisory.activity if ev.advisory else None,
        "advisory": ev.advisory.model_dump() if ev.advisory else None,
        "location": ev.location.model_dump() if ev.location else None,
        "sources": [s.model_dump() for s in ev.sources],
        "evidence_quality": ev.evidence_quality,
        "abstain_reason": ev.abstain_reason,
        "clarification": ev.clarification,
        "alerts_state": ev.alerts.state,
        "active_alerts": [a.model_dump() for a in ev.alerts.items],
    }


@app.get("/api/overview")
async def overview() -> Dict[str, Any]:
    """ADDITIVE: small read-only dashboard/map summary over a fixed list of major Indian cities.

    Current conditions only, fetched concurrently through the SAME provider as /api/query. This is
    NOT forecast/risk/alert logic — no risk is computed here, and no alert data is attached (alerts
    are the evidence pipeline's job). A city whose fetch fails is reported with ok=false rather than
    dropped or faked.
    """
    cities = [
        ("Mumbai", 19.0760, 72.8777),
        ("New Delhi", 28.6139, 77.2090),
        ("Pune", 18.5204, 73.8567),
        ("Bengaluru", 12.9716, 77.5946),
        ("Manali", 32.2432, 77.1892),
        ("Kolkata", 22.5726, 88.3639),
        ("Chennai", 13.0827, 80.2707),
        ("Hyderabad", 17.3850, 78.4867),
    ]

    async def one(name: str, lat: float, lon: float) -> Dict[str, Any]:
        try:
            bundle = await weather.get_provider().fetch(lat, lon, timeframe="now", timezone="auto")
        except UpstreamError as exc:
            return {"name": name, "lat": lat, "lng": lon, "ok": False, "error": f"{exc.service}: {exc.detail}"}
        cur = bundle.current
        return {
            "name": name,
            "lat": lat,
            "lng": lon,
            "ok": True,
            "provider": bundle.provider,
            "model": bundle.model,
            "kind": bundle.kind,
            "retrieved_at_utc": bundle.retrieved_at_utc,
            "current": cur.model_dump() if cur else None,
        }

    results = await asyncio.gather(*(one(n, la, lo) for n, la, lo in cities))
    ok_results = [r for r in results if r.get("ok")]
    return {
        "ok": True,
        "authority": "research_repro",
        "provider": config.WEATHER_PROVIDER,
        "note": "Current conditions from the configured weather provider (Open-Meteo, research/reproducibility). No IMD data, no risk computation.",
        "places": [r for r in results if r.get("ok")],
        "failures": [r for r in results if not r.get("ok")],
        "retrieved_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }


@app.get("/api/climate")
async def climate(place: str = "Mumbai", context: str | None = None, years: int = 7) -> Dict[str, Any]:
    """ADDITIVE: multi-year climate trends for a place, aggregated from the Open-Meteo HISTORICAL
    ARCHIVE. Explicitly research_repro authority — never presented as official IMD climate data.
    Geocodes the place first so a name is enough for the dashboard."""
    geo = await geocoding.resolve(place, context=context)
    if geo.status != "ok" or geo.location is None:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": f"could not resolve a unique location for {place!r}",
                "geocode": geo.model_dump(),
            },
        )
    try:
        payload = await climate_service.fetch_climate(
            geo.location.latitude,
            geo.location.longitude,
            place_name=geo.location.name,
            years=max(1, min(years, 20)),
        )
    except UpstreamError as exc:
        return JSONResponse(
            status_code=502,
            content={"ok": False, "error": f"{exc.service}: {exc.detail}",
                     "note": "climate archive could not be consulted; no trend data is shown"},
        )
    payload["location"] = geo.location.name
    payload["admin1"] = geo.location.admin1
    return payload


# Convenience single-purpose endpoints kept for component testing / demos.
@app.get("/api/geocode")
async def geocode(name: str, context: str | None = None, country_bias: str | None = "") -> Dict[str, Any]:
    res = await geocoding.resolve(name, context=context, country_bias=country_bias)
    return res.model_dump()


@app.get("/api/alerts")
async def direct_alerts(place: str, context: str | None = None) -> Dict[str, Any]:
    """Phase 2 component check: resolve a place, then run ONLY the SACHET path."""
    geo = await geocoding.resolve(place, context=context)
    if geo.status != "ok" or geo.location is None:
        return {"ok": False, "geocode": geo.model_dump()}
    res = await alerts_service.check_alerts(geo.location)
    return {
        "ok": True,
        "location": geo.location.model_dump(),
        "alerts": res.model_dump(),
        "relevant_headlines": [a.headline for a in res.items],
    }


@app.get("/api/weather")
async def direct_weather(
    latitude: float, longitude: float, timeframe: str = "now", timezone: str = "auto"
) -> Dict[str, Any]:
    try:
        bundle = await weather.get_provider().fetch(
            latitude, longitude, timeframe=timeframe, timezone=timezone  # type: ignore[arg-type]
        )
    except UpstreamError as exc:
        return {"ok": False, "error": f"{exc.service}: {exc.detail}"}
    return {"ok": True, "weather": bundle.model_dump()}


# --------------------------------------------------------------------------- #
# SPA fallback — MUST be registered LAST so it can never shadow an API route.
# Any non-API GET path (e.g. /chat, /alerts on a hard reload) returns index.html.
# --------------------------------------------------------------------------- #
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "health", "docs", "openapi.json")):
        return JSONResponse(status_code=404, content={"detail": "not found"})
    if _has_built_app():
        # Hashed assets live under /assets (mounted above); other files in dist root (favicon,
        # icons) are served directly when present, otherwise the SPA shell handles the route.
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
    return JSONResponse(
        status_code=404,
        content={"detail": "frontend not built; see / for API info"},
    )
