/**
 * chatService.ts — conversational queries. Real answers come from POST /api/query (the full
 * grounded pipeline: parse -> geocode -> evidence -> validation -> advisory -> grounded LLM).
 * The chat UI only displays what the backend decided; it never re-derives risk or weather.
 *
 * Demo mode (explicit opt-in, default off) returns bundled SAMPLE responses, clearly badged.
 */
import type { QueryAnalysis, WeatherAlert, WeatherEvidence } from '../types';
import { MOCK_ALERTS } from '../mocks/alerts';
import { getSessionId, queryBackend } from './backendClient';
import {
  detectLanguage,
  mapAdvisory,
  mapAlerts,
  mapEvidence,
  mapQueryAnalysis,
} from './mappers';
import type { QueryResultView } from '../types';

export interface AskQueryResponse {
  message: string;
  queryAnalysis: QueryAnalysis;
  evidence?: WeatherEvidence;
  activeAlert?: WeatherAlert;
  alerts?: WeatherAlert[];
  view?: QueryResultView;
  isSample: boolean;
}

/** SAMPLE path — used ONLY in demo mode. Kept self-contained and clearly badged. */
function sampleResponse(userQuery: string, currentLocationName: string, language: string): AskQueryResponse {
  const lowerQuery = userQuery.toLowerCase();
  const evidence: WeatherEvidence = {
    ...MOCK_WEATHER_SAMPLE,
    location: currentLocationName,
    source: 'SAMPLE DATA',
    authority: 'sample',
    sourcePriority: 'SAMPLE',
    isSample: true,
  };
  const alert = MOCK_ALERTS.find((a) => a.locationId === 'mumbai');
  const detected: QueryAnalysis['language'] =
    language === 'hi' ? 'Hindi' : language === 'mr' ? 'Marathi' : detectLanguage(userQuery);
  const intent: QueryAnalysis['intent'] = lowerQuery.includes('alert')
    ? 'Alert'
    : lowerQuery.includes('travel') || lowerQuery.includes('drive')
    ? 'Travel'
    : 'Current';
  const message =
    intent === 'Alert'
      ? alert
        ? `[SAMPLE] ${alert.title}: ${alert.officialMessage}`
        : '[SAMPLE] No sample alert is attached for this location.'
      : `[SAMPLE] Current weather in ${currentLocationName} is ${evidence.temperature}°C, ${evidence.conditionText}. This is bundled demo data, not a live source.`;
  return {
    message,
    queryAnalysis: {
      intent,
      location: currentLocationName,
      timeframe: 'Current',
      language: detected,
      dataSourcesUsed: ['SAMPLE DATA'],
      validationStatus: 'SAMPLE_DATA',
    },
    evidence,
    activeAlert: alert ? { ...alert, source: 'SAMPLE DATA', isOfficial: false, isSample: true } : undefined,
    isSample: true,
  };
}

const MOCK_WEATHER_SAMPLE: WeatherEvidence = {
  source: 'SAMPLE DATA',
  authority: 'sample',
  sourcePriority: 'SAMPLE',
  location: 'Mumbai',
  observedAt: '—',
  temperature: 30,
  feelsLike: 33,
  humidity: 75,
  rainfall: 2,
  windSpeed: 15,
  pressure: 1008,
  warningsCount: 0,
  evidenceQuality: 'MEDIUM',
  conditionText: 'Sample conditions',
  isSample: true,
};

export async function askWeatherGPT(
  userQuery: string,
  currentLocationName = 'Mumbai',
  language = 'en',
  useDemo = false,
  activity?: string,
  sessionId?: string,
): Promise<AskQueryResponse> {
  if (useDemo) {
    return sampleResponse(userQuery, currentLocationName, language);
  }

  // U4: the UI language ('en'|'hi'|'mr'|'hinglish') is the response language. It rides as
  // structured request metadata; the backend puts it inside the Evidence so the answer text
  // AND the spoken TTS voice follow the same choice. Unknown values default to English.
  const answerLang =
    language === 'hi' || language === 'mr' || language === 'hinglish' ? language : 'en';

  const res = await queryBackend({
    message: userQuery,
    // Only pass the location as a hint; the backend does its own geocoding and disambiguation.
    // U3: sessionId lets the backend resolve follow-ups ("is it safe?", "what about tomorrow?")
    // from the previous turn's structured context — the frontend sends no chat history.
    locationHint: currentLocationName,
    activity,
    language: answerLang,
    // Conversational turn: use the shared session (the caller may pass it explicitly; default
    // to the shared id so Chat AND Voice always participate in the SAME conversation).
    sessionId: sessionId ?? getSessionId(),
    conversational: true,
    includePipeline: true, // needed to show which slots a follow-up inherited ("how understood")
  });

  const ev = res.evidence;
  const { active } = mapAlerts(ev);
  const evidence = mapEvidence(ev);
  const advisory = mapAdvisory(
    ev.advisory ?? null,
    ev.location ? [ev.location.name, ev.location.admin1].filter(Boolean).join(', ') : currentLocationName,
  );

  const view: QueryResultView = {
    status: res.status,
    message:
      res.answer?.text || ev.abstain_reason || ev.clarification || 'No grounded answer is available.',
    evidence,
    hourly: [],
    daily: [],
    alerts: active,
    expiredAlerts: [],
    advisory: advisory ?? undefined,
    risk: ev.risk ?? null,
    quality: ev.evidence_quality ?? undefined,
    sources: [],
    abstainReason: ev.abstain_reason ?? undefined,
    clarification: ev.clarification ?? undefined,
    answer: res.answer ?? undefined,
    raw: ev,
  };

  return {
    message: view.message,
    queryAnalysis: mapQueryAnalysis(ev, userQuery, res.answer, res.pipeline),
    evidence,
    activeAlert: active[0],
    alerts: active,
    view,
    isSample: false,
  };
}
