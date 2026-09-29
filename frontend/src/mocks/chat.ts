import type { ChatMessage } from '../types';

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    // FRESH START: a greeting only — no seeded conversation, no evidence, and crucially NO
    // alert. A fake/official-looking alert must never appear on startup. Real answers (and any
    // real official SACHET alert) arrive from the backend only after the user asks a question.
    id: 'msg-welcome',
    sender: 'assistant',
    text: 'Namaste! I am WeatherGPT, your grounded weather intelligence assistant. Ask about live weather, official NDMA/SACHET alerts, or travel safety for a city or district — in English, Hindi, Hinglish or Marathi. For example: “Is it safe to travel in Mumbai?” and then just “What about tomorrow?”.',
    timestamp: '',
  },
];

export const MOCK_RESPONSES_BY_INTENT: Record<string, ChatMessage> = {
  'rain_today': {
    id: 'resp-rain-today',
    sender: 'assistant',
    text: 'Yes, moderate to heavy showers are expected in Mumbai today, particularly between 1:00 PM and 4:00 PM IST with a 68% precipitation probability.',
    timestamp: 'Just now',
    queryAnalysis: {
      intent: 'Forecast',
      location: 'Mumbai',
      timeframe: 'Today',
      language: 'English',
      dataSourcesUsed: ['SAMPLE DATA'],
      validationStatus: 'SAMPLE_DATA',
    },
    evidence: {
      source: 'SAMPLE DATA',
      authority: 'sample',
    sourcePriority: 'SAMPLE',
      location: 'Mumbai, Maharashtra',
      observedAt: '10:30 AM IST',
      validFrom: '10:30 AM IST',
      validUntil: '11:59 PM IST',
      temperature: 31,
      feelsLike: 35,
      humidity: 74,
      rainfall: 18.5,
      windSpeed: 22,
      pressure: 1007,
      uvIndex: 6,
      visibility: 4.5,
      rainProbability: 68,
      warningsCount: 1,
      evidenceQuality: 'HIGH',
      conditionText: 'Moderate Showers',
      conditionCode: 'RAIN_MODERATE',
    },
  },
  'travel_advisory': {
    id: 'resp-travel',
    sender: 'assistant',
    text: 'Weather-related travel risk is MODERATE today for Mumbai-Pune Expressway. Heavy rain spells may reduce visibility below 3km between Lonavala ghat sections.',
    timestamp: 'Just now',
    queryAnalysis: {
      intent: 'Travel',
      location: 'Mumbai-Pune Route',
      timeframe: 'Today',
      language: 'English',
      dataSourcesUsed: ['SAMPLE DATA'],
      validationStatus: 'SAMPLE_DATA',
    },
    evidence: {
      source: 'SAMPLE DATA',
      authority: 'sample',
    sourcePriority: 'SAMPLE',
      location: 'Mumbai & Lonavala Ghats',
      observedAt: '10:30 AM IST',
      validFrom: '10:30 AM IST',
      validUntil: '08:00 PM IST',
      temperature: 28,
      feelsLike: 30,
      humidity: 82,
      rainfall: 22.0,
      windSpeed: 25,
      pressure: 1008,
      uvIndex: 4,
      visibility: 2.8,
      rainProbability: 72,
      warningsCount: 1,
      evidenceQuality: 'HIGH',
      conditionText: 'Fog & Heavy Ghat Showers',
      conditionCode: 'FOG_RAIN',
    },
  },
};
