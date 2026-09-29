/**
 * forecastService.ts — hourly + daily forecast for a location.
 *
 * Real data: POST /api/query (daily today/tomorrow + additive next-24h hourly block from
 * Open-Meteo). Only the days/hours the backend actually returns are shown; nothing is
 * padded. Demo mode returns bundled SAMPLE data, clearly badged.
 */
import type { DailyForecast, HourlyForecast } from '../types';
import { MOCK_DAILY_FORECASTS, MOCK_HOURLY_FORECASTS } from '../mocks/forecast';
import { queryBackend } from './backendClient';
import { mapDaily, mapHourly } from './mappers';

export interface ForecastLookup {
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  isSample: boolean;
}

function sampleForecast(locationId: string): ForecastLookup {
  const key = locationId.toLowerCase();
  return {
    hourly: (MOCK_HOURLY_FORECASTS[key] || MOCK_HOURLY_FORECASTS['mumbai']).map((h) => ({
      ...h,
      icon: h.icon || 'cloud-sun',
    })),
    daily: (MOCK_DAILY_FORECASTS[key] || MOCK_DAILY_FORECASTS['mumbai']).map((d) => ({
      ...d,
      icon: d.icon || 'cloud-sun',
    })),
    isSample: true,
  };
}

export async function getForecast(
  locationId: string,
  useDemo = false,
  locationHint?: string,
): Promise<ForecastLookup> {
  if (useDemo) return sampleForecast(locationId);
  const res = await queryBackend({
    message: `What is the weather forecast for ${locationHint || locationId} today and tomorrow?`,
    locationHint: locationHint || locationId,
    conversational: false,
  });
  return {
    hourly: mapHourly(res.evidence.weather?.hourly),
    daily: mapDaily(res.evidence),
    isSample: false,
  };
}
