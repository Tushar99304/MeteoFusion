/**
 * weatherService.ts — current weather for a location.
 *
 * Real data: POST /api/query via the grounded pipeline (returns Open-Meteo current
 * conditions, research/reproducibility — never labelled IMD). Demo mode (explicit opt-in,
 * default off) falls back to clearly-labelled SAMPLE data.
 */
import type { WeatherEvidence } from '../types';
import { MOCK_WEATHER_DATA } from '../mocks/weather';
import { queryBackend } from './backendClient';
import { mapEvidence } from './mappers';

export interface WeatherLookup {
  evidence: WeatherEvidence | undefined;
  isSample: boolean;
}

function sampleWeather(locationId: string): WeatherEvidence {
  const key = locationId.toLowerCase();
  return {
    ...(MOCK_WEATHER_DATA[key] || MOCK_WEATHER_DATA['mumbai']),
    source: 'SAMPLE DATA',
    authority: 'sample',
    sourcePriority: 'SAMPLE',
    isSample: true,
  };
}

/**
 * Fetch current weather. `locationHint` is the place name (and optional state). When
 * `useDemo` is true we return bundled SAMPLE data, clearly badged. Network failure in live
 * mode propagates so the caller can show an honest offline/error state.
 */
export async function getCurrentWeather(
  locationId: string,
  useDemo = false,
  locationHint?: string,
): Promise<WeatherLookup> {
  if (useDemo) {
    return { evidence: sampleWeather(locationId), isSample: true };
  }
  const message = `What is the current weather in ${locationHint || locationId}?`;
  const res = await queryBackend({ message, locationHint: locationHint || locationId, conversational: false });
  return { evidence: mapEvidence(res.evidence), isSample: false };
}
