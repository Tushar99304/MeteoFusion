/**
 * mappers.ts — PURE, one-directional conversion of backend Evidence/Answer/Alert/Advisory
 * into the frontend view models (types/index.ts).
 *
 * Invariants enforced here (the React side must never do the backend's job):
 *  - No weather, risk, alert or grounding decision is made here. Values are copied and
 *    relabelled only; gaps stay `undefined` and the UI renders an honest placeholder.
 *  - Sources are labelled truthfully: weather = Open-Meteo (research_repro); only SACHET
 *    alerts are "official". Nothing is ever labelled IMD.
 *  - Expired alerts are returned separately and NEVER appear in the active alert list.
 *  - Risk level / quality / answer text come straight from the backend fields.
 */
import type {
  BackendAdvisory,
  BackendAlert,
  BackendAnswer,
  BackendClimateResponse,
  BackendEvidence,
  BackendForecastDay,
  BackendHourlyPoint,
  BackendQueryResponse,
  BackendSource,
} from '../types/backend';
import type {
  ChatMessage,
  ClimateResult,
  DailyForecast,
  HourlyForecast,
  QueryAnalysis,
  QueryResultView,
  WeatherAdvisory,
  WeatherAlert,
  WeatherEvidence,
} from '../types/index';

/* ------------------------------------------------------------------ utils */

export function detectLanguage(text: string): QueryAnalysis['language'] {
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  const lower = text.toLowerCase();
  if (
    /\b(kya|hai|hain|hogi|hoga|baarish|barish|kal|aaj|mausam|barkha|kahiye|batao)\b/.test(lower)
  ) {
    return 'Hinglish';
  }
  return 'English';
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  // Backend current.time is naive local wall time "YYYY-MM-DDTHH:MM"; show HH:MM.
  const t = iso.includes('T') ? iso.split('T')[1] : iso;
  return t.slice(0, 5);
}

function dayName(dateStr?: string | null, label?: string | null): string {
  if (label) return label;
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function conditionToIcon(condition?: string | null, code?: number | null): string {
  const c = (condition || '').toLowerCase();
  if (code === 95 || code === 96 || code === 99 || c.includes('thunder') || c.includes('lightning'))
    return 'cloud-lightning';
  if (c.includes('heavy rain') || c.includes('violent')) return 'cloud-heavy-rain';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'cloud-rain';
  if (c.includes('snow')) return 'cloud-snow';
  if (c.includes('fog') || c.includes('mist')) return 'cloud-fog';
  if (c.includes('cloud') || c.includes('overcast')) return 'cloud';
  if (c.includes('clear') || c.includes('sunny')) return 'sun';
  return 'cloud-sun';
}

/* --------------------------------------------------------- source mapping */

function sourceAuthorityLabel(source: BackendSource): string {
  switch (source.authority) {
    case 'official':
      return 'NDMA SACHET (official)';
    case 'research_repro':
      return source.name; // "Open-Meteo"
    case 'derived':
      return `${source.name} (derived)`;
    default:
      return source.name;
  }
}

/* ------------------------------------------------------- current weather */

export function mapEvidence(ev: BackendEvidence): WeatherEvidence | undefined {
  const cur = ev.weather?.current;
  const loc = ev.location;
  // No weather block (clarify/abstain-before-retrieval) means no evidence card: the UI must
  // show the clarification/abstention instead of an empty "weather evidence" record.
  if (!ev.weather || !cur) return undefined;

  const weatherSource = ev.weather?.provider
    ? ev.weather.provider === 'open-meteo'
      ? 'Open-Meteo'
      : ev.weather.provider
    : 'Open-Meteo';

  const activeAlerts = (ev.alerts?.items ?? []).filter((a) => a.validity === 'active');

  return {
    source: weatherSource as WeatherEvidence['source'],
    authority: 'research_repro',
    providerModel: ev.weather?.model || undefined,
    sourcePriority: 'MODEL_SECONDARY',
    location: loc ? [loc.name, loc.admin1].filter(Boolean).join(', ') : 'Unknown location',
    observedAt: cur ? fmtTime(cur.time) : '—',
    retrievedAtUtc: ev.weather?.retrieved_at_utc,
    requestUrl: ev.weather?.request_url,
    temperature: cur?.temperature_c ?? undefined,
    feelsLike: cur?.apparent_temperature_c ?? undefined,
    humidity: cur?.humidity_pct ?? undefined,
    rainfall: cur?.precipitation_mm ?? undefined,
    windSpeed: cur?.wind_speed_kmh ?? undefined,
    windDirectionDeg: cur?.wind_direction_deg ?? undefined,
    pressure: cur?.pressure_hpa ?? undefined,
    cloudCover: cur?.cloud_cover_pct ?? undefined,
    // rainProbability is a DAILY value; only surface it from today's block (never "current").
    rainProbability: ev.weather?.today?.precipitation_probability_max_pct ?? undefined,
    warningsCount: activeAlerts.length,
    evidenceQuality: ev.evidence_quality ?? undefined,
    conditionText: cur?.condition ?? ev.weather?.today?.condition ?? undefined,
    conditionCode: cur ? conditionToIcon(cur.condition, cur.weather_code) : undefined,
    // uvIndex / visibility intentionally omitted — the backend evidence does not contain them.
  };
}

/* ----------------------------------------------------------- forecast */

export function mapHourly(points?: BackendHourlyPoint[] | null): HourlyForecast[] {
  if (!points) return [];
  return points.map((p) => ({
    time: fmtTime(p.time),
    temp: p.temperature_c ?? undefined,
    rainProb: p.precipitation_probability_pct ?? undefined,
    rainfall: p.precipitation_mm ?? undefined,
    condition: p.condition ?? undefined,
    icon: conditionToIcon(p.condition, p.weather_code),
    humidity: p.humidity_pct ?? undefined,
    windSpeed: p.wind_speed_kmh ?? undefined,
  }));
}

function mapDay(day: BackendForecastDay): DailyForecast {
  return {
    date: day.date,
    dayName: day.label || dayName(day.date),
    isForecast: day.is_forecast,
    tempMin: day.temperature_min_c ?? undefined,
    tempMax: day.temperature_max_c ?? undefined,
    rainProb: day.precipitation_probability_max_pct ?? undefined,
    expectedRainfallMm: day.precipitation_sum_mm ?? undefined,
    condition: day.condition ?? undefined,
    icon: conditionToIcon(day.condition, day.weather_code),
    windSpeed: day.wind_speed_max_kmh ?? undefined,
    // humidity is not in the daily block; left undefined (UI hides it).
    summary: day.is_forecast
      ? `${day.condition ?? 'Forecast'} — ${day.precipitation_probability_max_pct ?? '—'}% rain probability, ${day.precipitation_sum_mm ?? '—'} mm expected.`
      : 'Observed/past model day (not a forecast).',
  };
}

export function mapDaily(ev: BackendEvidence): DailyForecast[] {
  const w = ev.weather;
  if (!w) return [];
  const days: BackendForecastDay[] = [];
  if (w.today) days.push(w.today);
  if (w.tomorrow) days.push(w.tomorrow);
  if (w.target_day && !days.some((d) => d.date === w.target_day?.date)) days.push(w.target_day);
  // past_days already includes today/tomorrow rows in the live bundle; de-dupe by date.
  for (const d of w.past_days ?? []) {
    if (d && !days.some((x) => x.date === d.date)) days.push(d);
  }
  // Keep chronological order, cap at the real days the provider returned (no invented rows).
  return days
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(mapDay);
}

/* ------------------------------------------------------------- alerts */

function capSeverityToBucket(severity?: string | null): WeatherAlert['severity'] {
  // Real CAP severities are returned VERBATIM; this fallback only covers sample data.
  switch ((severity || '').toLowerCase()) {
    case 'extreme':
    case 'severe':
      return severity as WeatherAlert['severity'];
    case 'moderate':
    case 'minor':
      return severity as WeatherAlert['severity'];
    default:
      return 'NONE';
  }
}

export function mapAlert(a: BackendAlert, loc?: { lat: number; lng: number }): WeatherAlert {
  return {
    id: a.alert_id || `alert-${a.sent_at || a.headline}`,
    title: a.headline || a.event || 'Official alert',
    severity: capSeverityToBucket(a.severity) || (a.severity as WeatherAlert['severity']),
    affectedArea: a.area_desc || '—',
    source: a.source || 'NDMA SACHET',
    officialMessage: a.description || undefined,
    event: a.event || undefined,
    instruction: a.instruction || undefined,
    recommendedActions: a.instruction ? [a.instruction] : [],
    isOfficial: a.authority === 'official',
    validity: a.validity,
    urgency: a.urgency || undefined,
    certainty: a.certainty || undefined,
    category: a.category || undefined,
    issueTime: a.effective_at || a.sent_at || undefined,
    expiryTime: a.expires_at || undefined,
    relevanceLevel: a.relevance?.level,
    relevanceReason: a.relevance?.reason || a.match_reason || undefined,
    sourceUrl: a.source_url || a.raw_source_url || undefined,
    coordinates: loc ? [loc.lat, loc.lng] : undefined,
  };
}

export function mapAlerts(ev: BackendEvidence): {
  active: WeatherAlert[];
  expired: WeatherAlert[];
} {
  const loc = ev.location ? { lat: ev.location.latitude, lng: ev.location.longitude } : undefined;
  // Fixture replay (ALERT_FIXTURE_RSS) is a recorded SAMPLE for testing, never a live official
  // pull: badge every mapped alert so the UI cannot present it as a current official alert.
  const isFixture = ev.alerts?.mode === 'fixture_replay';
  const tagFixture = (alert: WeatherAlert): WeatherAlert =>
    isFixture
      ? {
          ...alert,
          isSample: true,
          isOfficial: false,
          source: 'SAMPLE FIXTURE (ALERT_FIXTURE_RSS)',
          title: `[SAMPLE FIXTURE] ${alert.title}`,
        }
      : alert;
  const active = (ev.alerts?.items ?? [])
    .filter((a) => a.validity === 'active')
    .map((a) => tagFixture(mapAlert(a, loc)));
  // Expired alerts are surfaced ONLY in a labelled transparency section — never as active.
  const expired = [
    ...(ev.alerts?.recent_expired ?? []),
    ...(ev.alerts?.items ?? []).filter((a) => a.validity === 'expired'),
  ]
    .map((a) => mapAlert(a, loc))
    .map(tagFixture);
  return { active, expired };
}

/* ----------------------------------------------------------- advisory */

export function mapAdvisory(
  adv: BackendAdvisory | null | undefined,
  locationName: string,
  category?: string,
): WeatherAdvisory | undefined {
  if (!adv) return undefined;
  const officialWarning = (adv.alert_ids?.length ?? 0) > 0;
  return {
    category: category || 'Travel',
    location: locationName,
    riskLevel: adv.risk_level,
    activity: adv.activity,
    primaryRiskReason: adv.headline,
    detailedReasons: adv.factors ?? [],
    recommendation: adv.reason,
    officialWarningActive: officialWarning,
    rulesFired: adv.rules_fired ?? [],
    alertIds: adv.alert_ids ?? [],
    disclaimer: adv.disclaimer,
  };
}

/* ------------------------------------------------------- query analysis */

function mapIntent(ev: BackendEvidence): QueryAnalysis['intent'] {
  const intent = String(ev.request?.intent ?? 'forecast_current');
  if (intent === 'official_alert') return 'Alert';
  if (intent === 'advisory_risk') return 'Travel';
  if (intent === 'historical_climate') return 'Climate';
  if (intent === 'clarification_needed') return 'General';
  return 'Forecast';
}

function mapValidationStatus(ev: BackendEvidence): QueryAnalysis['validationStatus'] {
  if (ev.status === 'abstain') return 'ABSTAINED';
  if (ev.status === 'clarify') return 'CLARIFICATION_NEEDED';
  const hasOfficial = (ev.sources ?? []).some((s) => s.authority === 'official');
  if (ev.alerts?.state === 'unavailable') return 'ALERTS_UNVERIFIABLE';
  if (hasOfficial) return 'GROUNDED_OFFICIAL_CHECKED';
  return 'GROUNDED_MODEL_DATA';
}

export function mapQueryAnalysis(
  ev: BackendEvidence,
  userText: string,
  answer?: BackendAnswer | null,
  pipeline?: Record<string, unknown> | null,
): QueryAnalysis {
  const sources = (ev.sources ?? []).map(sourceAuthorityLabel);
  const timeframe = String(ev.request?.timeframe ?? 'now');
  // U3: which slots a follow-up inherited from the previous turn (for the "how understood" UI).
  const conv = (pipeline?.conversation ?? null) as
    | { context_used?: Record<string, string> }
    | null;
  const contextUsed = conv?.context_used
    ? Object.entries(conv.context_used)
        .filter(([, from]) => from === 'context')
        .map(([slot]) => slot)
    : undefined;
  // Fine-grained practical topic from the parse stage (query understanding only).
  const stages = (pipeline?.stages ?? []) as Array<{ stage?: string; topic?: string }>;
  const topic = stages.find((s) => s.stage === 'parse')?.topic;
  return {
    intent: mapIntent(ev),
    location: ev.location?.name ?? 'Unknown location',
    timeframe,
    language: detectLanguage(userText),
    dataSourcesUsed: sources.length ? Array.from(new Set(sources)) : ['Open-Meteo'],
    validationStatus: mapValidationStatus(ev),
    answerOrigin: answer?.origin,
    groundingVerified: answer?.grounding?.verified,
    groundingNote: answer?.grounding?.note || undefined,
    contextUsed: contextUsed && contextUsed.length ? contextUsed : undefined,
    topicLabel: topic && topic !== 'other' ? humanizeTopic(topic) : undefined,
  };
}

/** Turn the backend topic key into a short, human label for the "how understood" panel. */
function humanizeTopic(topic: string): string {
  const labels: Record<string, string> = {
    weather_summary: 'Weather summary',
    temperature: 'Temperature',
    rain_prediction: 'Rain prediction',
    umbrella_advice: 'Umbrella / rain practical advice',
    travel_safety: 'Travel safety',
    outdoor_suitability: 'Outdoor activity suitability',
    official_alert: 'Official alert',
    historical_climate: 'Historical / climate',
  };
  return labels[topic] ?? topic.replace(/_/g, ' ');
}

/* --------------------------------------------------------- whole query */

export function mapQueryResponse(res: BackendQueryResponse): QueryResultView {
  const ev = res.evidence;
  const { active, expired } = mapAlerts(ev);
  const message =
    res.answer?.text ||
    ev.abstain_reason ||
    ev.clarification ||
    'No grounded answer is available for this request.';

  return {
    status: res.status,
    message,
    evidence: mapEvidence(ev),
    hourly: mapHourly(ev.weather?.hourly),
    daily: mapDaily(ev),
    alerts: active,
    expiredAlerts: expired,
    advisory: mapAdvisory(
      ev.advisory,
      ev.location ? [ev.location.name, ev.location.admin1].filter(Boolean).join(', ') : 'this area',
    ),
    risk: ev.risk ?? ev.advisory?.risk_level ?? null,
    quality: ev.evidence_quality ?? undefined,
    sources: (ev.sources ?? []).map((s) => ({
      name: sourceAuthorityLabel(s),
      authority: s.authority,
      type: s.type,
      note: s.note ?? undefined,
    })),
    alertsState: ev.alerts?.state,
    alertsError: ev.alerts?.error ?? undefined,
    abstainReason: ev.abstain_reason ?? undefined,
    clarification: ev.clarification ?? undefined,
    answer: res.answer ?? undefined,
    raw: ev,
    location: ev.location
      ? {
          name: ev.location.name,
          lat: ev.location.latitude,
          lng: ev.location.longitude,
          admin1: ev.location.admin1 ?? undefined,
        }
      : undefined,
  };
}

/** Build a ChatMessage view model from a mapped query result. */
export function mapToChatMessage(view: QueryResultView, userText: string): ChatMessage {
  const analysis: QueryAnalysis | undefined = view.raw
    ? mapQueryAnalysis(view.raw, userText, view.answer)
    : undefined;
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: 'assistant',
    text: view.message,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    evidence: view.evidence,
    queryAnalysis: analysis,
    activeAlert: view.alerts[0],
    alerts: view.alerts,
    advisory: view.advisory,
    status: view.status,
    abstainReason: view.abstainReason,
    clarification: view.clarification,
  };
}

/* ------------------------------------------------------------ climate */

export function mapClimate(res: BackendClimateResponse, placeName: string): ClimateResult {
  if (!res || res.ok === false || !Array.isArray(res.annual) || res.annual.length === 0) {
    return {
      points: [],
      monthly: [],
      location: placeName,
      available: false,
      note: 'Research climate archive could not be consulted for this location.',
    };
  }
  const points: ClimateResult['points'] = res.annual.map((a) => ({
    year: a.year,
    rainfallActual: a.rainfall_mm,
    rainfallNormal: a.rainfall_normal_mm,
    tempAvg: a.temp_avg_c ?? undefined,
    tempAnomaly: a.temp_anomaly_c ?? undefined,
    extremeEventsCount: a.heavy_rain_days,
  }));
  const monthly: ClimateResult['points'] = (res.monthly ?? []).map((m) => ({
    year: m.year,
    month: m.month,
    rainfallActual: m.rainfall_mm,
    rainfallNormal: 0,
    tempAvg: m.temp_avg_c ?? undefined,
    extremeEventsCount: 0,
  }));
  return {
    points,
    monthly,
    location: res.location || placeName,
    period: res.period,
    disclaimer:
      res.disclaimer ||
      'Aggregated from the Open-Meteo ERA5 reanalysis archive (research/reproducibility) — not official IMD climate data.',
    note: res.heavy_rain_note,
    available: true,
  };
}
