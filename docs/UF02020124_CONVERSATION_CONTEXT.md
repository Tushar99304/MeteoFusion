# U3 — Controlled conversation context + honest sample-alert default

This document describes two additive changes. Neither touches the core weather/grounding
pipeline; the LLM still receives **exactly one structured `Evidence` object and nothing else**.

## Part A — The sample SACHET alert no longer appears on a fresh start

**Root cause (frontend).** The chat store seeded a fake 3-message conversation on load
(`frontend/src/mocks/chat.ts` → `INITIAL_CHAT_MESSAGES`). Its assistant message carried an
`activeAlert` titled *"SAMPLE: Heavy Rainfall Warning (demo data)"* with `isOfficial: true`,
which the chat renderer turns into the red **"OFFICIAL NDMA / SACHET ALERT ACTIVE"** banner.
That banner therefore appeared on every startup even in live mode.

**Fix.** The seed is now a single greeting message — no evidence, no alert. A real official
SACHET alert only ever appears after the backend retrieves one for a question.

**Backend fixture stays opt-in.** `ALERT_FIXTURE_RSS` (`backend/config.py`) is an environment
variable that defaults to empty. It is read only in `backend/services/alerts.py::check_alerts`,
and only substitutes the *state* feed when explicitly set. Nothing in backend defaults,
fallback logic, dev mode, or frontend initialization enables it:

| Situation | Behaviour |
| --- | --- |
| Fresh startup, real SACHET healthy | live alerts shown; nothing fabricated |
| Real SACHET returns an active official alert | shown normally, **keeps precedence** (R1 HIGH) |
| SACHET unavailable | honest `state=unavailable` / UNCERTAIN; **never** the fixture |
| `ALERT_FIXTURE_RSS=...` explicitly set | fixture replay; `mode=fixture_replay`, validation warning *"recorded fixture, not a live SACHET pull"*; frontend badges it **SAMPLE/FIXTURE** (amber, not the red official banner) |

The frontend `mapAlerts` now tags every alert as `isSample/isOfficial=false, source="SAMPLE FIXTURE …", title="[SAMPLE FIXTURE] …"` when `alerts.mode === "fixture_replay"`.

## Part B — Controlled conversation context

### Flow

```
message + session_id
   → parsing.parse()            deterministic intent/location/timeframe (+ Hindi/Marathi/Hinglish)
   → context.resolve_turn()     fill blank slots from the previous RESOLVED turn
   → geocode (or reuse resolved place)
   → weather + SACHET alerts    (unchanged)
   → validation → quality → deterministic advisory (risk fixed before any sentence)
   → LLM(ev.model_dump()) → grounding verify  (LLM sees the one Evidence object only)
   → store this turn's resolved slots for the session
```

### What is remembered (and what is not)

`backend/services/context.py::ConversationContext` holds a deliberately tiny, weather-focused
record per session:

- `location_text` and the **resolved** `ResolvedLocation` (name + coordinates + admin1/timezone)
- `timeframe`, `target_date`, `intent`, `activity`, `language`
- `turn_count`, `updated_at` (TTL: 1 hour)

It **never** stores raw message text, chat history, LLM output, weather numbers, or alerts.
Only a message's *parsed slots* and the *verified geocoded place* are stored.

### Resolution rules

- A slot is inherited from context **only when the new message does not state it**.
- Explicit new information always wins.
  - "Will it rain in Mumbai tomorrow?" → "What about Pune?" → place becomes **Pune**.
  - then "What about tomorrow?" → place stays **Pune**, day becomes **tomorrow**.
- "what/how about <place>" is a **place-only** follow-up: the location changes and the
  previous topic/intent (e.g. travel safety) is kept.
- A bare reference ("there", "is it safe?", "will it rain?") reuses the prior location/topic.
- If a reference has **no antecedent** (e.g. "Is it safe to travel?" as the very first message),
  the pipeline returns `clarify` — *"Which location should I check?…"* — and retrieves nothing.
  It never guesses a city.
- A remembered, already-geocoded place is reused directly (follow-ups skip geocoding for "there").

### Multilingual query understanding

`backend/services/parsing.py` adds deterministic Hindi/Marathi/Hinglish slot extraction
(script-alias mapping only — it never produces weather values):

| Message | location | timeframe |
| --- | --- | --- |
| `kal mumbai mei baarish hogi kya?` | Mumbai | tomorrow |
| `kal Mumbai mein baarish hogi kya?` | Mumbai | tomorrow |
| `aaj Pune ka mausam kaisa hai?` | Pune | today |
| `kya kal Delhi mein baarish hogi?` | Delhi | tomorrow |
| `उद्या मुंबईत पाऊस पडेल का` | Mumbai | tomorrow |
| `आज पुण्याचे हवामान कसे आहे` | Pune | today |

Devanagari place names are mapped via a small alias table; an unmapped Devanagari place is
**clarified**, not guessed.

### Session handling & isolation

- `ConversationStore` is a process-wide, thread-safe dict keyed by an opaque `session_id`
  (`uuid4().hex`, minted by the frontend and persisted in `localStorage`).
- There is no shared/global default context; one id cannot read another's context
  (asserted by tests). Context expires after the TTL and is forgotten on a server restart
  (safe failure mode). No database is used.
- `POST /api/session/reset {session_id}` forgets a conversation; the chat "clear" button rotates
  the id **and** calls reset so a new conversation cannot inherit the old location/topic.

### API

- `POST /api/query` and `GET /api/pipeline` accept `session_id`.
- `QueryResponse` echoes `session_id`; the `parse` trace stage reports `context_used`
  (slot → `"message" | "context" | "default"`) and the pipeline carries a `conversation` block.
- The frontend "How WeatherGPT understood your question" panel shows the **resolved**
  location/timeframe and, when a follow-up inherited slots, a
  *"Conversation context reused: location, timeframe from your previous message"* note.

## Limitations

- Context is **in-process**: multiple uvicorn workers do not share it, and a restart clears it.
  Adequate for the MVP/demo; a Redis/DB store would be the production step.
- Turn-relative date arithmetic stays relative ("tomorrow" is resolved at retrieval in the
  location's timezone, as before); only an explicit `YYYY-MM-DD` is pinned.
- Multilingual coverage targets common weather phrases and a fixed set of major Indian place
  names; arbitrary Devanagari places are clarified rather than guessed.
- Context never crosses with the LLM: the model never sees history, so it cannot "remember"
  free-form facts — only the structured slots the pipeline carries.

## U3.1 — One shared session across Chat AND Voice (integration pass)

**Root cause of the Voice bug.** The Voice page (`components/voice/VoiceControl.tsx`) called
`askWeatherGPT(...)` **without** passing a `sessionId`, so every spoken query ran with no
session → the backend had no antecedent and correctly asked "Which location…". Other
`/api/query` callers (dashboard current/forecast/alert/advisory services) sent no id either.

**Fix — a single shared session mechanism, used by every natural-language query:**

- The session id lives in ONE place (`services/backendClient.ts`): `getSessionId()` reads/
  lazily-mints an opaque id persisted in `localStorage` (per tab/conversation).
- `queryBackend()` **auto-injects `session_id` = `getSessionId()`** whenever a caller doesn't
  pass one explicitly, and always sends a `conversational` flag. Chat and Voice therefore share
  the identical session with no per-page or per-request id generation.
- "Clear chat / new conversation" calls `newSessionId()` (rotates the id) **and**
  `POST /api/session/reset` (forgets the backend's context for the old id).
- **Conversational vs background:** Chat/Voice turns send `conversational: true` (read + write
  the context). Dashboard sync fetches (`weatherService`, `forecastService`, `alertService`,
  `advisoryService`) send `conversational: false`: they neither read nor write conversation
  memory, so loading/refreshing a page can never hijack or pollute the active conversation.
- The backend gates context on this flag: non-conversational calls skip `resolve_turn`, never
  trigger the missing-location clarify, and never call `STORE.put`.

**Fine-grained intent (topic).** `ParsedQuery.topic` (additive; risk still comes only from the
advisory engine) classifies the practical ask: `rain_prediction`, `umbrella_advice`,
`travel_safety`, `outdoor_suitability`, `temperature`, `weather_summary`, `official_alert`,
`historical_climate`. A specific new topic wins; a vague follow-up inherits the prior topic, so
"Is it going to rain?" → "Should I carry an umbrella?" stays coherent and "What about Pune?"
keeps asking the same thing for the new place. Shown in the "How WeatherGPT understood…" panel.

**Multilingual word order.** The Hinglish location rule now captures the single place token
immediately before a postposition (`mumbai mei/me/mein/ka/…`), independent of word order, so
all of these resolve to Mumbai + tomorrow + rain:
`kya kal baarish hogi mumbai mei?`, `Mumbai mein kal baarish hogi?`, `kya kal Mumbai mein…`,
`kya kal baarish hogi Mumbai mein?`, `Mumbai me kal rain hogi kya?`, `kal Mumbai mein…`.

### Verified conversation evolution (offline, shared session across Chat→Voice→Chat)

| Turn | Message | location | timeframe | topic |
| --- | --- | --- | --- | --- |
| T1 | What's the weather in Mumbai tomorrow? | Mumbai | tomorrow | weather_summary |
| T2 | Is it going to rain? | Mumbai | tomorrow | rain_prediction |
| T3 | Should I carry an umbrella? | Mumbai | tomorrow | umbrella_advice |
| T4 | Is it safe to travel? | Mumbai | tomorrow | travel_safety |
| T5 | What about Pune? | Pune | tomorrow | travel_safety |
| T6 | And tomorrow morning? | Pune | tomorrow | travel_safety |

Session isolation (A=Mumbai vs B=Pune vs C=none → clarify) and "clear → new session forgets"
are regression-tested.

## Tests

- `tests/test_u3_conversation.py` — 29 offline tests (context resolution, reference rules,
  multilingual extraction, session isolation/reset, LLM receives only Evidence, grounding,
  alert precedence, abstention, fixture opt-in/default, HTTP continuity).
- Frontend: `frontend/src/services/mappers.test.ts` (15 tests) incl. fixture-badging;
  quality gate `scripts/check_frontend.mjs`.
