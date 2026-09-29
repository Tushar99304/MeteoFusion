/**
 * types/backend.ts — TypeScript mirror of the backend Pydantic contract.
 *
 * These are the RAW shapes returned by the FastAPI backend (snake_case, exactly as
 * backend/models.py serialises them). The UI NEVER reads these directly in components:
 * src/services/mappers.ts converts them into the view-model types in types/index.ts.
 *
 * Keep these in sync with backend/models.py. Fields the backend may omit (abstain/clarify
 * paths) are optional.
 */

export type BackendStatus = 'grounded' | 'abstain' | 'clarify' | 'error';
export type BackendRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN' | null;
export type BackendQuality = 'HIGH' | 'MEDIUM' | 'LOW' | null;

export interface BackendResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  country_code?: string | null;
  admin1?: string | null;
  admin2?: string | null;
  timezone?: string | null;
  utc_offset_seconds?: number | null;
  population?: number | null;
  geonames_id?: number | null;
  resolution_note?: string;
}

export interface BackendCurrentWeather {
  time: string;
  temperature_c?: number | null;
  apparent_temperature_c?: number | null;
  humidity_pct?: number | null;
  precipitation_mm?: number | null;
  wind_speed_kmh?: number | null;
  wind_direction_deg?: number | null;
  pressure_hpa?: number | null;
  cloud_cover_pct?: number | null;
  weather_code?: number | null;
  condition?: string | null;
  units?: Record<string, string>;
}

export interface BackendForecastDay {
  date: string;
  label: string;
  is_forecast: boolean;
  temperature_max_c?: number | null;
  temperature_min_c?: number | null;
  precipitation_sum_mm?: number | null;
  precipitation_probability_max_pct?: number | null;
  wind_speed_max_kmh?: number | null;
  weather_code?: number | null;
  condition?: string | null;
}

export interface BackendHourlyPoint {
  time: string;
  temperature_c?: number | null;
  precipitation_mm?: number | null;
  precipitation_probability_pct?: number | null;
  humidity_pct?: number | null;
  wind_speed_kmh?: number | null;
  weather_code?: number | null;
  condition?: string | null;
}

export interface BackendWeatherBundle {
  provider: string;
  model: string;
  kind: 'live' | 'historical';
  requested_timeframe: string;
  retrieved_at_utc: string;
  elevation_m?: number | null;
  current?: BackendCurrentWeather | null;
  today?: BackendForecastDay | null;
  tomorrow?: BackendForecastDay | null;
  target_day?: BackendForecastDay | null;
  past_days?: BackendForecastDay[];
  hourly?: BackendHourlyPoint[];
  request_url?: string;
}

export type BackendAlertValidity = 'active' | 'expired' | 'unknown';

export interface BackendAlert {
  alert_id?: string | null;
  source: string;
  authority: 'official';
  sender?: string | null;
  author_name?: string | null;
  event?: string | null;
  headline?: string | null;
  description?: string | null;
  instruction?: string | null;
  severity?: string | null;   // Minor | Moderate | Severe | Extreme (verbatim CAP)
  urgency?: string | null;    // Expected | Immediate | Future | Past
  certainty?: string | null;
  category?: string | null;
  area_desc?: string | null;
  cap_status?: string | null;
  msg_type?: string | null;
  language?: string | null;
  sent_at?: string | null;
  effective_at?: string | null;
  onset_at?: string | null;
  expires_at?: string | null;
  validity: BackendAlertValidity;
  validity_reason?: string;
  age_minutes?: number | null;
  source_url?: string | null;
  raw_source_url?: string | null;
  match_reason?: string;
  relevance?: {
    status: 'relevant' | 'not_relevant' | 'uncertain';
    level: string;
    reason: string;
    matched_terms?: string[];
    area_text?: string | null;
    geometry_available?: boolean;
  };
}

export interface BackendAlertsEvidence {
  source: string;
  authority: 'official';
  state: 'checked' | 'not_checked' | 'unavailable';
  mode: 'live' | 'fixture_replay' | 'disabled' | 'not_run';
  error?: string | null;
  checked_at_utc?: string | null;
  feeds_considered?: string[];
  items_in_feeds?: number;
  details_fetched?: number;
  items: BackendAlert[];
  recent_expired?: BackendAlert[];
  rejected_duplicate?: number;
  rejected_not_relevant?: number;
  rejected_uncertain?: number;
  rejected_stale?: number;
  notes?: string[];
}

export interface BackendSource {
  name: string;
  type: 'forecast' | 'current' | 'historical' | 'official_alert' | 'geocoding';
  timestamp?: string | null;
  period?: string | null;
  url?: string | null;
  authority: 'official' | 'research_repro' | 'derived';
  note?: string | null;
}

export interface BackendValidation {
  ok: boolean;
  sufficient: boolean;
  fresh?: boolean | null;
  complete?: boolean | null;
  location_resolved: boolean;
  timestamp_present: boolean;
  values_plausible?: boolean | null;
  alerts_valid?: boolean | null;
  labeling_consistent?: boolean | null;
  alert_integrity?: boolean | null;
  source_age_minutes?: number | null;
  checks_run: string[];
  failures: string[];
  warnings: string[];
}

export interface BackendAdvisory {
  risk_level: Exclude<BackendRisk, null>;
  activity: string;
  headline: string;
  reason: string;
  factors: string[];
  rules_fired: string[];
  alert_ids: string[];
  evidence_quality?: BackendQuality;
  disclaimer: string;
}

export interface BackendEvidence {
  schema_version: string;
  status: BackendStatus;
  request: Record<string, unknown>;
  location?: BackendResolvedLocation | null;
  weather?: BackendWeatherBundle | null;
  alerts: BackendAlertsEvidence;
  sources: BackendSource[];
  validation: BackendValidation;
  evidence_quality?: BackendQuality;
  quality_breakdown?: Record<string, unknown>;
  risk?: BackendRisk;
  advisory?: BackendAdvisory | null;
  abstain_reason?: string | null;
  clarification?: string | null;
  alert_state?: string;
}

export interface BackendGroundingReport {
  verified: boolean;
  checks_run: string[];
  failures: string[];
  numbers_checked: number;
  numbers_rejected: string[];
  attempts: number;
  regenerated: boolean;
  llm_status: string;
  model?: string | null;
  latency_ms?: number | null;
  note: string;
}

export interface BackendAnswer {
  text: string;
  source: string;
  timestamp?: string | null;
  risk?: BackendRisk;
  evidence_quality?: BackendQuality;
  alert_mentioned: boolean;
  origin: 'groq_llm' | 'deterministic_fallback';
  grounding: BackendGroundingReport;
}

export interface BackendQueryResponse {
  status: BackendStatus;
  user_message: string;
  evidence: BackendEvidence;
  pipeline: Record<string, unknown>;
  answer?: BackendAnswer | null;
  /** U3: echoed conversation id for context continuity. */
  session_id?: string | null;
}

export interface BackendHealth {
  ok: boolean;
  weather_provider: string;
  weather_providers?: unknown;
  llm?: { configured: boolean; provider: string; model: string };
  alerts?: { enabled: boolean; source: string; max_age_h?: number; mode?: string };
  phase3?: Record<string, unknown>;
  simulations?: Record<string, unknown>;
  utc_now?: string;
}

export interface BackendOverviewPlace {
  name: string;
  lat: number;
  lng: number;
  ok: boolean;
  error?: string;
  provider?: string;
  model?: string;
  kind?: string;
  retrieved_at_utc?: string;
  current?: BackendCurrentWeather | null;
}

export interface BackendOverviewResponse {
  ok: boolean;
  authority: string;
  provider: string;
  note?: string;
  places: BackendOverviewPlace[];
  failures?: BackendOverviewPlace[];
}

export interface BackendClimateAnnual {
  year: number;
  rainfall_mm: number;
  rainfall_normal_mm: number;
  temp_avg_c?: number | null;
  temp_anomaly_c?: number | null;
  heavy_rain_days: number;
}

export interface BackendClimateMonthly {
  year: number;
  month: string;
  rainfall_mm: number;
  temp_avg_c?: number | null;
}

export interface BackendClimateResponse {
  ok: boolean;
  authority: 'research_repro';
  source: string;
  kind: string;
  location?: string;
  admin1?: string | null;
  period?: string;
  normals_basis?: string;
  heavy_rain_threshold_mm?: number;
  heavy_rain_note?: string;
  disclaimer?: string;
  annual: BackendClimateAnnual[];
  monthly?: BackendClimateMonthly[];
}
