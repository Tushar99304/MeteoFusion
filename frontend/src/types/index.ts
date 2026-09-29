import type {
  BackendAdvisory,
  BackendAlert,
  BackendAnswer,
  BackendEvidence,
  BackendRisk,
} from './backend';

/**
 * View-model types for the UI. These are produced from the backend contract by
 * src/services/mappers.ts. The frontend never invents weather/risk/alert values:
 * optional fields simply mean "the backend evidence did not contain this", and the UI
 * renders an honest placeholder instead of a number.
 */

export type EvidenceQuality = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Display source labels. Weather data comes from Open-Meteo (research/reproducibility);
 * NDMA SACHET is the only OFFICIAL authority in the system. There is intentionally no
 * live "IMD" data source wired — claiming IMD would be fabrication.
 */
export type SourceType = 'Open-Meteo' | 'NDMA SACHET' | 'GFS' | 'CACHED' | 'SAMPLE DATA';

export type SourceAuthority = 'official' | 'research_repro' | 'derived' | 'sample';

/**
 * Alert severity. The backend carries the verbatim CAP severity (Minor/Moderate/Severe/
 * Extreme); those are the authoritative values. WATCH/ALERT/WARNING are kept only for
 * backwards compatibility with sample/demo data and are never produced from real alerts.
 */
export type AlertSeverity =
  | 'NONE'
  | 'WATCH'
  | 'ALERT'
  | 'WARNING'
  | 'Minor'
  | 'Moderate'
  | 'Severe'
  | 'Extreme';

export type ActivityCategory =
  | 'Driving'
  | 'Travel'
  | 'Outdoor Event'
  | 'Trekking'
  | 'Agriculture'
  | 'Marine'
  | 'Daily Activity';

/** Risk now includes UNCERTAIN — the backend refuses to call risk low when it cannot verify. */
export type WeatherRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN';

/** Answer outcome, mirroring the backend's top-level status. */
export type AnswerStatus = 'grounded' | 'abstain' | 'clarify' | 'error';

export interface Location {
  id: string;
  name: string;
  state: string;
  district?: string;
  lat: number;
  lng: number;
  isPopular?: boolean;
}

export interface WeatherEvidence {
  source: SourceType;
  authority: SourceAuthority;
  providerModel?: string;
  sourcePriority: 'OFFICIAL_DISASTER' | 'MODEL_SECONDARY' | 'CACHED_LOCAL' | 'SAMPLE';
  location: string;
  observedAt?: string;
  /** Free-text observedAt label may be absent until real data is loaded. */
  validFrom?: string;
  validUntil?: string;
  temperature?: number;
  feelsLike?: number;
  humidity?: number;
  rainfall?: number; // mm (current reported interval)
  windSpeed?: number; // km/h
  pressure?: number; // hPa
  cloudCover?: number; // %
  windDirectionDeg?: number;
  /** NOT provided by the backend — always undefined for real data; UI hides UV tiles. */
  uvIndex?: number;
  /** NOT provided by the backend — always undefined for real data; UI hides visibility. */
  visibility?: number;
  rainProbability?: number; // daily max %, when the forecast block carries it
  warningsCount: number;
  evidenceQuality?: EvidenceQuality;
  conditionText?: string;
  conditionCode?: string;
  retrievedAtUtc?: string;
  requestUrl?: string;
  isSample?: boolean;
}

export interface HourlyForecast {
  time: string;
  temp?: number;
  rainProb?: number;
  rainfall?: number;
  condition?: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
}

export interface DailyForecast {
  date: string;
  dayName: string;
  isForecast?: boolean;
  tempMin?: number;
  tempMax?: number;
  rainProb?: number;
  expectedRainfallMm?: number;
  condition?: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
  summary?: string;
}

export interface WeatherAlert {
  id: string;
  title: string;
  /** CAP severity verbatim for real alerts; legacy buckets for sample data. */
  severity: AlertSeverity;
  affectedArea: string;
  locationId?: string;
  issueTime?: string;
  expiryTime?: string;
  source: SourceType | string;
  officialMessage?: string;
  weatherEvidenceSummary?: string;
  recommendedActions?: string[];
  isOfficial: boolean;
  validity?: 'active' | 'expired' | 'unknown';
  urgency?: string;
  certainty?: string;
  category?: string;
  event?: string;
  instruction?: string;
  relevanceLevel?: string;
  relevanceReason?: string;
  sourceUrl?: string;
  coordinates?: [number, number];
  isSample?: boolean;
}

export interface WeatherAdvisory {
  category: ActivityCategory | string;
  location: string;
  date?: string;
  riskLevel: WeatherRiskLevel;
  primaryRiskReason: string;
  detailedReasons: string[];
  recommendation: string;
  officialWarningActive: boolean;
  rulesFired?: string[];
  alertIds?: string[];
  disclaimer?: string;
  activity?: string;
  isSample?: boolean;
}

export interface QueryAnalysis {
  intent: 'Forecast' | 'Alert' | 'Current' | 'Travel' | 'Climate' | 'General' | 'Advisory';
  location: string;
  timeframe: string;
  language: 'English' | 'Hindi' | 'Marathi' | 'Hinglish';
  dataSourcesUsed: string[];
  validationStatus:
    | 'GROUNDED_OFFICIAL_CHECKED'
    | 'GROUNDED_MODEL_DATA'
    | 'ALERTS_UNVERIFIABLE'
    | 'ABSTAINED'
    | 'CLARIFICATION_NEEDED'
    | 'SAMPLE_DATA';
  answerOrigin?: 'groq_llm' | 'deterministic_fallback';
  groundingVerified?: boolean;
  groundingNote?: string;
  /** U3: slots a follow-up inherited from the previous turn (e.g. location from context). */
  contextUsed?: string[];
  /** U3: fine-grained practical topic resolved by the backend (rain, umbrella, travel…). */
  topicLabel?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  evidence?: WeatherEvidence;
  queryAnalysis?: QueryAnalysis;
  activeAlert?: WeatherAlert;
  /** Full official alerts attached to the response (active, relevant). */
  alerts?: WeatherAlert[];
  advisory?: WeatherAdvisory;
  status?: AnswerStatus;
  abstainReason?: string;
  clarification?: string;
  isStale?: boolean;
  offlineFallback?: boolean;
  language?: string;
  isSample?: boolean;
}

export interface ClimateDataPoint {
  year: number;
  month?: string;
  rainfallActual: number;
  rainfallNormal: number;
  tempAvg?: number;
  tempAnomaly?: number;
  extremeEventsCount: number;
}

export interface ClimateResult {
  points: ClimateDataPoint[];
  monthly: ClimateDataPoint[];
  location: string;
  period?: string;
  disclaimer?: string;
  note?: string;
  available: boolean;
}

export type ApiStatus = 'REAL' | 'DEGRADED' | 'DEMO' | 'OFFLINE';

export interface ConnectionState {
  isOnline: boolean;
  apiStatus: ApiStatus;
  lastSyncedAt: string | null;
  syncInProgress: boolean;
  activeSource: string;
  llmConfigured?: boolean;
  alertsEnabled?: boolean;
}

export interface UserPreferences {
  tempUnit: '°C' | '°F';
  windUnit: 'km/h' | 'm/s';
  language: 'en' | 'hi' | 'mr';
  /** Demo = bundled SAMPLE data, clearly badged. Default OFF: the real backend is used. */
  demoMode: boolean;
  smsAlertsEnabled: boolean;
  pushNotifications: boolean;
  autoDetectLocation: boolean;
}

/** The mapped result of one /api/query call, kept in the store for pages to reuse. */
export interface QueryResultView {
  status: AnswerStatus;
  message: string;
  evidence?: WeatherEvidence;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  alerts: WeatherAlert[];
  expiredAlerts: WeatherAlert[];
  advisory?: WeatherAdvisory;
  risk?: BackendRisk;
  quality?: EvidenceQuality;
  sources: { name: string; authority: string; type: string; note?: string }[];
  alertsState?: string;
  alertsError?: string;
  abstainReason?: string;
  clarification?: string;
  answer?: BackendAnswer;
  raw?: BackendEvidence;
  location?: { name: string; lat: number; lng: number; admin1?: string };
}

export type { BackendAdvisory, BackendAlert, BackendAnswer, BackendEvidence };
