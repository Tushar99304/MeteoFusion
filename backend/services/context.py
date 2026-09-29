"""
context.py — U3 controlled conversation-context layer.

PROBLEM THIS SOLVES
-------------------
A real conversation does not repeat every fact each turn:

    User: "Is it safe to travel in Mumbai?"
    User: "Is it safe to travel?"          -> must reuse Mumbai
    User: "What about tomorrow?"           -> must keep Mumbai, change the date
    User: "What about Pune?"               -> must change only the place to Pune

The naïve fix (dump the whole chat history into the LLM prompt) is FORBIDDEN here: it
would break the grounding architecture. This module therefore implements a *small,
structured, session-scoped* memory instead:

    user message
      -> parsing.parse()           (intent / location_text / timeframe; deterministic)
      -> context.resolve_turn()    (fill the SLOTS the new message leaves blank from the
                                    previous turn's RESOLVED query)
      -> the existing WeatherGPT pipeline (geocode -> weather -> alerts -> validate ->
         quality -> deterministic advisory -> LLM -> grounding)

SAFETY PROPERTIES (all enforced below and covered by tests/test_u3_conversation.py)
-----------------------------------------------------------------------------------
* The LLM still receives exactly ONE structured Evidence object. Raw conversation text is
  never stored as a reasoning source and never sent to the model — only the handful of
  weather-relevant slots below are remembered.
* A slot is carried forward ONLY when the new message does not explicitly provide it.
  Explicit new information always wins ("...in Pune" overrides a remembered Mumbai).
* We never fabricate a location/date. If the references cannot be resolved from context
  (e.g. "Is it safe to travel?" as the very first message), the caller gets
  ``needs_clarification`` and the pipeline asks instead of guessing.
* Memory is keyed by an opaque ``session_id`` and held in an in-process dict: one
  browser/session cannot read another's context. There is no database and no cross-session
  shared default. The store is per-process (sufficient for the MVP/demo); a restart clears
  it, which is the safe failure mode.

This layer performs QUERY UNDERSTANDING ONLY. It never invents weather values; the evidence
pipeline still retrieves every number.
"""

from __future__ import annotations

import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

from backend.models import ParsedQuery, ResolvedLocation

# How long a session's context is kept if untouched. A fresh browser tab gets a new id, so
# stale memory cannot silently steer a later conversation.
CONTEXT_TTL_SECONDS = 60 * 60  # 1 hour

# A message that is *only* a reference ("there", "tomorrow?", "what about Pune?") carries no
# standalone intent; the parser would call that "clarification_needed". In context we keep the
# previous turn's intent for such elliptical follow-ups. These phrases never introduce a new
# weather topic of their own.
_ELLIPTICAL_RE = re.compile(
    r"""^\s*(
        what\s+about\b.* |
        how\s+about\b.* |
        and\s+(?:in|for|at)\b.* |
        (?:is\s+it|will\s+it|should\s+i|can\s+i)\b.*\?* |
        (?:there|here|tomorrow|today|tonight)\b[\s?.!]* |
        the\s+day\s+after(?:\s+tomorrow)?[\s?.!]*
    )\s*$""",
    re.IGNORECASE | re.VERBOSE,
)


@dataclass
class ConversationContext:
    """The ONLY facts remembered between turns. Deliberately tiny and weather-focused.

    ``location`` is the *resolved* place (coordinates + name) from the previous SUCCESSFUL
    geocode, so a follow-up can skip geocoding entirely and still answer for the identical
    spot. ``location_text`` is the name we re-show in the UI / re-geocode if needed.
    """

    location_text: Optional[str] = None
    location: Optional[ResolvedLocation] = None
    timeframe: Optional[str] = None          # ParsedQuery.timeframe value
    target_date: Optional[str] = None        # YYYY-MM-DD when pinned
    intent: Optional[str] = None             # ParsedQuery.intent value
    topic: Optional[str] = None              # ParsedQuery.topic value (fine-grained)
    activity: Optional[str] = None           # advisory sector (driving/marine/...)
    language: Optional[str] = None           # detected UI/conversation language hint
    turn_count: int = 0
    updated_at: float = field(default_factory=lambda: time.time())

    def is_fresh(self, now: Optional[float] = None) -> bool:
        return (now or time.time()) - self.updated_at < CONTEXT_TTL_SECONDS


@dataclass
class ResolvedTurn:
    """Result of merging the new message with remembered context.

    ``effective_message`` is the message the rest of the pipeline should parse/run (the user's
    own words, never rewritten with fabricated content), while the slots below describe what
    context filled in. ``needs_clarification`` is True only when a reference has no antecedent.
    """

    parsed: ParsedQuery
    context_used: Dict[str, str]            # slot -> where it came from ("message"|"context")
    carried_location: bool = False
    clarification: Optional[str] = None

    @property
    def needs_clarification(self) -> bool:
        return self.clarification is not None


class ConversationStore:
    """Thread-safe, session-keyed, in-memory context. No shared defaults between sessions."""

    def __init__(self) -> None:
        self._sessions: Dict[str, ConversationContext] = {}
        self._lock = threading.Lock()

    @staticmethod
    def new_session_id() -> str:
        """Opaque, unguessable id. The frontend mints one per browser tab/conversation."""
        return uuid.uuid4().hex

    def get(self, session_id: Optional[str]) -> Optional[ConversationContext]:
        if not session_id:
            return None
        with self._lock:
            ctx = self._sessions.get(session_id)
            if ctx is None:
                return None
            if not ctx.is_fresh():
                # Expired -> forget. A follow-up after TTL must ask again, not use stale memory.
                self._sessions.pop(session_id, None)
                return None
            return ctx

    def put(
        self,
        session_id: str,
        *,
        location_text: Optional[str] = None,
        location: Optional[ResolvedLocation] = None,
        timeframe: Optional[str] = None,
        target_date: Optional[str] = None,
        intent: Optional[str] = None,
        topic: Optional[str] = None,
        activity: Optional[str] = None,
        language: Optional[str] = None,
    ) -> ConversationContext:
        """Record what THIS turn resolved to. Only non-None/non-'other' values overwrite memory."""
        with self._lock:
            ctx = self._sessions.get(session_id) or ConversationContext()
            if location_text is not None:
                ctx.location_text = location_text
            if location is not None:
                ctx.location = location
            if timeframe is not None:
                ctx.timeframe = timeframe
            if target_date is not None:
                # An explicit date is remembered too ("tomorrow" stays the day the user meant
                # until they change it); None means "no pinned date" and also clears an old one.
                ctx.target_date = target_date
            if intent is not None:
                ctx.intent = intent
            if topic is not None and topic != "other":
                ctx.topic = topic
            if activity is not None:
                ctx.activity = activity
            if language is not None:
                ctx.language = language
            ctx.turn_count += 1
            ctx.updated_at = time.time()
            self._sessions[session_id] = ctx
            return ctx

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def reset_location(self, session_id: str) -> None:
        """Used when a remembered place fails to geocode on a later turn: drop it so the next
        turn asks rather than repeatedly failing on a stale spot."""
        with self._lock:
            ctx = self._sessions.get(session_id)
            if ctx:
                ctx.location_text = None
                ctx.location = None

    def active_sessions(self) -> int:
        with self._lock:
            now = time.time()
            return sum(1 for c in self._sessions.values() if c.is_fresh(now))


# A single process-wide store. Each session_id is isolated; there is intentionally no global
# "current context" that one request could leak into another.
STORE = ConversationStore()


def _is_elliptical_followup(message: str) -> bool:
    """True for messages that only refer back ("what about tomorrow?", "there?", "and in Pune?")."""
    return bool(_ELLIPTICAL_RE.match(message.strip()))


def resolve_turn(parsed: ParsedQuery, ctx: Optional[ConversationContext]) -> ResolvedTurn:
    """Merge a freshly-parsed turn with remembered context.

    Rules:
      * location: if the new message names no place, reuse the previous resolved location.
        If there is no remembered location, we cannot answer -> clarification (never guess).
      * timeframe: an explicit timeframe word in the message wins; otherwise carry the previous
        one. ("What about tomorrow?" provides the timeframe itself; "Is it safe to travel?" does
        not, so it inherits the prior day.)
      * intent: an explicit weather/safety/alert intent wins; an elliptical follow-up with no
        topic of its own inherits the prior intent.
      * target_date: an explicit pinned date wins; otherwise inherit the prior one.

    The user's message is never rewritten — context only fills blank slots, and every fill is
    recorded in ``context_used`` so the UI/trace can show it.
    """
    context_used: Dict[str, str] = {}

    # ---- location ----------------------------------------------------------- #
    carried_location = False
    if not parsed.location_text:
        if ctx is not None and ctx.location_text:
            # Reference resolution: "there" / "here" / a bare follow-up -> the last place.
            parsed.location_text = ctx.location_text
            carried_location = True
            context_used["location"] = "context"
        else:
            # No place in the message and no antecedent -> ask, do not invent a city.
            return ResolvedTurn(
                parsed=parsed,
                context_used=context_used,
                clarification=(
                    "Which location should I check? Please give me a city or district name "
                    "(for example, \u201cIs it safe to travel in Mumbai?\u201d)."
                ),
            )
    else:
        context_used["location"] = "message"

    # ---- timeframe ---------------------------------------------------------- #
    if parsed.timeframe and parsed.timeframe != "unspecified":
        context_used["timeframe"] = "message"
    elif ctx is not None and ctx.timeframe:
        parsed.timeframe = ctx.timeframe  # type: ignore[assignment]
        context_used["timeframe"] = "context"
    else:
        context_used["timeframe"] = "default"

    # An explicit calendar date wins; otherwise inherit a previously pinned date only when the
    # message did not itself state a day.
    if parsed.target_date:
        context_used["target_date"] = "message"
    elif ctx is not None and ctx.target_date and parsed.timeframe == (ctx.timeframe or None):
        parsed.target_date = ctx.target_date
        context_used["target_date"] = "context"

    # ---- intent ------------------------------------------------------------- #
    elliptical = _is_elliptical_followup(parsed.message)
    # "What about <place>?" / "How about <place>?" changes ONLY the place: keep the previous
    # turn's topic (e.g. travel safety) rather than the parser's generic forecast default.
    about_place_only = bool(
        re.match(r"^\s*(?:what|how)\s+about\b", parsed.message, re.IGNORECASE)
    )
    if parsed.intent == "clarification_needed" and ctx is not None and ctx.intent and elliptical:
        # A bare follow-up ("what about tomorrow?", "is it safe?") continues the same topic.
        parsed.intent = ctx.intent  # type: ignore[assignment]
        parsed.intent_reason = f"{parsed.intent_reason}; carried over from previous turn"
        context_used["intent"] = "context"
    elif about_place_only and ctx is not None and ctx.intent:
        parsed.intent = ctx.intent  # type: ignore[assignment]
        parsed.intent_reason = f"{parsed.intent_reason}; topic carried over (place-only follow-up)"
        context_used["intent"] = "context"
    elif parsed.intent and parsed.intent != "clarification_needed":
        context_used["intent"] = "message"
    elif ctx is not None and ctx.intent:
        # Message had no weather signal but wasn't a bare reference either: still inherit the
        # topic so "should I go?" continues a travel-safety thread.
        parsed.intent = ctx.intent  # type: ignore[assignment]
        parsed.intent_reason = f"{parsed.intent_reason}; topic carried from previous turn"
        context_used["intent"] = "context"

    # ---- fine-grained topic ----------------------------------------------- #
    # A specific new topic always wins; a vague follow-up inherits the prior practical topic so
    # "is it going to rain?" -> "should I carry an umbrella?" stays coherent and "what about
    # Pune?" keeps asking the same practical thing for the new place.
    if parsed.topic and parsed.topic != "other":
        context_used["topic"] = "message"
    elif ctx is not None and ctx.topic:
        parsed.topic = ctx.topic  # type: ignore[assignment]
        context_used["topic"] = "context"

    parsed.notes.append(
        "conversation context: " + ", ".join(f"{k} from {v}" for k, v in context_used.items())
    )

    return ResolvedTurn(parsed=parsed, context_used=context_used, carried_location=carried_location)
