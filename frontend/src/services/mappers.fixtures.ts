/**
 * mappers.fixtures.ts — the same 8 backend payload shapes exercised by the reference-page
 * render gate (scripts/check_frontend_render.mjs), expressed as the typed BackendQueryResponse
 * the React app receives. Used by mappers.test.ts to prove the React mapping layer preserves
 * every safety invariant across states.
 */
import type { BackendQueryResponse } from '../types/backend';

const SRC_W = {
  name: 'Open-Meteo',
  type: 'forecast' as const,
  timestamp: '2026-09-01T07:45',
  authority: 'research_repro' as const,
  url: 'https://api.open-meteo.com/v1/forecast?fake=1',
};
const SRC_A = {
  name: 'NDMA SACHET',
  type: 'official_alert' as const,
  timestamp: '2026-09-01T02:29:00Z',
  authority: 'official' as const,
  url: 'https://sachet.ndma.gov.in/x',
};

const WEATHER = {
  provider: 'open-meteo',
  kind: 'live' as const,
  model: 'best_match',
  requested_timeframe: 'now',
  retrieved_at_utc: '2026-09-01T02:30:00Z',
  current: {
    time: '2026-09-01T07:45',
    temperature_c: 25.8,
    apparent_temperature_c: 28.0,
    humidity_pct: 88,
    precipitation_mm: 0,
    wind_speed_kmh: 12.4,
    condition: 'Overcast',
  },
  today: {
    date: '2026-09-01',
    label: 'Today',
    is_forecast: true,
    temperature_max_c: 30,
    temperature_min_c: 23,
    precipitation_sum_mm: 12,
    precipitation_probability_max_pct: 60,
    condition: 'Light rain',
  },
  hourly: [
    { time: '2026-09-01T08:00', temperature_c: 26.0, precipitation_probability_pct: 20, condition: 'Overcast' },
    { time: '2026-09-01T09:00', temperature_c: 27.0, precipitation_probability_pct: 40, condition: 'Partly cloudy' },
  ],
  request_url: 'https://api.open-meteo.com/v1/forecast?fake=1',
};

const LOCATION = {
  name: 'Pune',
  latitude: 18.51957,
  longitude: 73.85535,
  admin1: 'Maharashtra',
  admin2: 'Pune',
  country: 'India',
  timezone: 'Asia/Kolkata',
  utc_offset_seconds: 19800,
  population: 3115431,
  geonames_id: 1259229,
};

const VALIDATION = {
  ok: true,
  sufficient: true,
  fresh: true,
  complete: true,
  location_resolved: true,
  timestamp_present: true,
  values_plausible: true,
  alerts_valid: true,
  source_age_minutes: 15,
  checks_run: ['freshness', 'value_ranges'],
  failures: [],
  warnings: [],
};

const ADVISORY = {
  risk_level: 'LOW' as const,
  activity: 'outdoor activity/travel',
  headline:
    'Weather-related travel risk is LOW based on validated model weather and an official-alert check that came back empty.',
  reason: 'Current retrieved evidence shows no hazardous values for the asked timeframe.',
  factors: ['NDMA SACHET checked: no active official alert verifiably tied to this location'],
  rules_fired: ['R7_quiet'],
  alert_ids: [],
  evidence_quality: 'HIGH' as const,
  disclaimer:
    'Weather-related risk estimate derived from validated evidence — not an official order.',
};

const GROUNDING = {
  verified: true,
  numbers_checked: 3,
  numbers_rejected: [],
  attempts: 1,
  regenerated: false,
  llm_status: 'ok',
  model: 'llama-3.3-70b-versatile',
  latency_ms: 812.4,
  note: '',
  checks_run: ['required_fields', 'numbers(3)', 'source_identity'],
  failures: [],
};

function answer(text: string, over: Record<string, unknown> = {}) {
  return {
    text,
    source: 'Open-Meteo + NDMA SACHET',
    timestamp: '2026-09-01T07:45',
    risk: 'LOW',
    evidence_quality: 'HIGH',
    alert_mentioned: false,
    origin: 'groq_llm' as const,
    grounding: { ...GROUNDING, ...((over.grounding as object) ?? {}) },
    ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'grounding')),
  };
}

function evidence(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 'weathergpt-evidence/0.1',
    status: 'grounded',
    request: { message: 'weather in pune now', intent: 'forecast_current', timeframe: 'now' },
    location: LOCATION,
    weather: WEATHER,
    alerts: {
      source: 'NDMA SACHET',
      authority: 'official',
      state: 'checked',
      mode: 'live',
      checked_at_utc: '2026-09-01T02:29:00Z',
      items: [],
      recent_expired: [],
      items_in_feeds: 0,
      details_fetched: 0,
      feeds_considered: ['rss_maharashtra.xml'],
      notes: [],
      duration_ms: 640,
    },
    sources: [SRC_A, SRC_W],
    validation: VALIDATION,
    evidence_quality: 'HIGH',
    quality_breakdown: { score: 86, label: 'HIGH' },
    risk: 'LOW',
    advisory: ADVISORY,
    alert_state: 'checked',
    ...over,
  };
}

const ALERT_ITEM = {
  alert_id: 'IN-50',
  source: 'NDMA SACHET',
  authority: 'official' as const,
  sender: 'IMD Mumbai',
  event: 'Heavy Rain',
  headline: 'Heavy rain alert for Pune district',
  description: 'Heavy to very heavy rain likely over parts of Pune district.',
  instruction: 'Please follow SDMA guidelines.',
  area_desc: 'Pune district of Maharashtra',
  severity: 'Severe',
  urgency: 'Immediate',
  certainty: 'Likely',
  validity: 'active' as const,
  effective_at: '2026-09-01T02:00:00Z',
  expires_at: '2026-09-01T05:00:00Z',
  validity_reason: 'inside the published window',
  relevance: {
    status: 'relevant' as const,
    level: 'L1_exact_locality',
    reason: 'areaDesc names this place',
    geometry_available: false,
  },
  raw_source_url: 'https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=50',
};

const ALERT_EXPIRED = {
  ...ALERT_ITEM,
  alert_id: 'IN-OLD',
  validity: 'expired' as const,
  expires_at: '2026-09-01T04:00:00Z',
  validity_reason: 'expired at 2026-09-01T04:00:00Z',
  instruction: 'an expired instruction that must never render as active guidance',
};

export const FIXTURES: Record<string, BackendQueryResponse> = {
  groq_ok: {
    status: 'grounded',
    user_message: 'weather',
    evidence: evidence() as never,
    pipeline: {},
    answer: answer('It is 25.8 °C in Pune right now, with wind at 12.4 km/h.') as never,
  },
  fallback_no_key: {
    status: 'grounded',
    user_message: 'weather',
    evidence: evidence() as never,
    pipeline: {},
    answer: answer(
      'Currently 25.8 °C, wind 12.4 km/h. Source: Open-Meteo + NDMA SACHET.',
      {
        origin: 'deterministic_fallback',
        grounding: {
          llm_status: 'no_key',
          attempts: 0,
          model: null,
          latency_ms: 1.2,
          note: 'GROQ_API_KEY is not set — deterministic evidence-based answer used',
        },
      },
    ) as never,
  },
  rejected_then_fallback: {
    status: 'grounded',
    user_message: 'weather',
    evidence: evidence() as never,
    pipeline: {},
    answer: answer('Currently 25.8 °C in Pune.', {
      origin: 'deterministic_fallback',
      grounding: {
        llm_status: 'grounding_failed',
        attempts: 2,
        regenerated: true,
        verified: true,
        numbers_rejected: ['31.4 °c'],
        failures: [
          'answer states 31.4 c, but no such temperature value exists in the evidence',
        ],
      },
    }) as never,
  },
  alert_active: {
    status: 'grounded',
    user_message: 'alerts',
    evidence: evidence({
      alerts: {
        ...(evidence().alerts as object),
        items: [ALERT_ITEM],
        items_in_feeds: 1,
        details_fetched: 1,
      },
      risk: 'HIGH',
      advisory: {
        ...ADVISORY,
        risk_level: 'HIGH',
        rules_fired: ['R1_active_severe_official_alert'],
        alert_ids: ['IN-50'],
        factors: [
          'official Severe Heavy Rain from IMD Mumbai (valid until 2026-09-01T05:00:00Z)',
          'official instruction, quoted from IMD Mumbai: "Please follow SDMA guidelines."',
        ],
        headline: 'Weather-related travel risk is HIGH based on an active official alert.',
      },
    }) as never,
    pipeline: {},
    answer: answer(
      'A Severe Heavy Rain alert is active for Pune; it is 25.8 °C right now.',
      { risk: 'HIGH', alert_mentioned: true },
    ) as never,
  },
  u1_expired_not_active: {
    status: 'grounded',
    user_message: 'alerts',
    evidence: evidence({
      alerts: {
        ...(evidence().alerts as object),
        items: [],
        recent_expired: [ALERT_EXPIRED],
        items_in_feeds: 1,
        details_fetched: 1,
      },
    }) as never,
    pipeline: {},
    answer: answer(
      'No active official alert was verifiably tied to this location when SACHET was checked; that is a checked result, not a promise that none exists. It is 25.8 °C now.',
    ) as never,
  },
  unavailable: {
    status: 'grounded',
    user_message: 'alerts',
    evidence: evidence({
      alerts: {
        ...(evidence().alerts as object),
        state: 'unavailable',
        error: 'HTTP 503 from sachet.ndma.gov.in',
        mode: 'live',
      },
      sources: [SRC_W],
      risk: 'UNCERTAIN',
      advisory: {
        ...ADVISORY,
        risk_level: 'UNCERTAIN',
        rules_fired: ['R5_alerts_unverifiable'],
        headline:
          'Weather-related travel risk is UNCERTAIN: the official alert service could not be consulted.',
      },
    }) as never,
    pipeline: {},
    answer: answer(
      'The official alert service could not be verified at this time, so whether any alert is active is unknown. Currently 25.8 °C.',
      {
        risk: 'UNCERTAIN',
        source: 'Open-Meteo',
        grounding: { llm_status: 'upstream_error', verified: true, attempts: 1 },
      },
    ) as never,
  },
  abstain: {
    status: 'abstain',
    user_message: 'weather',
    evidence: evidence({
      status: 'abstain',
      abstain_reason:
        'I could not verify this evidence well enough to answer from it (stale). I will not present unverified numbers as fact.',
      validation: {
        ...VALIDATION,
        ok: false,
        sufficient: false,
        fresh: false,
        failures: ['provider timestamp is 361 min old, over the 90 min limit'],
        warnings: ['staleness'],
      },
      evidence_quality: 'LOW',
      risk: 'UNCERTAIN',
      quality_breakdown: { score: 56, label: 'LOW' },
    }) as never,
    pipeline: {},
    answer: answer(
      'I could not verify reliable weather information for this place and time, so I will not guess.',
      {
        risk: 'UNCERTAIN',
        evidence_quality: 'LOW',
        origin: 'deterministic_fallback',
        grounding: {
          llm_status: 'skipped',
          verified: true,
          numbers_checked: 0,
          note: 'evidence failed validation — abstention only',
        },
      },
    ) as never,
  },
  clarify: {
    status: 'clarify',
    user_message: 'springfield',
    evidence: evidence({
      status: 'clarify',
      weather: null,
      sources: [],
      alerts: { ...(evidence().alerts as object), state: 'not_checked' },
      clarification: 'I found multiple places matching “springfield”. Which location do you mean?',
      validation: { ...VALIDATION, ok: false, sufficient: false, complete: null },
      advisory: null,
      risk: null,
      evidence_quality: null,
      quality_breakdown: {},
      alert_state: 'not_checked',
    }) as never,
    pipeline: {},
    answer: null,
  },
};
