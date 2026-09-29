/**
 * climateService.ts — multi-year climate trends for the Climate page.
 *
 * Real data: GET /api/climate aggregates the Open-Meteo HISTORICAL ARCHIVE (ERA5
 * reanalysis). This is research/reproducibility data and is labelled as such; it is never
 * official IMD climate data. Demo mode returns bundled SAMPLE series, clearly badged.
 */
import type { ClimateResult } from '../types';
import { MOCK_CLIMATE_ANNUAL, MOCK_CLIMATE_MONTHLY } from '../mocks/climate';
import { fetchClimate } from './backendClient';
import { mapClimate } from './mappers';

export async function getClimate(
  place: string,
  useDemo = false,
): Promise<{ result: ClimateResult; isSample: boolean }> {
  if (useDemo) {
    return {
      result: {
        points: MOCK_CLIMATE_ANNUAL,
        monthly: MOCK_CLIMATE_MONTHLY,
        location: place || 'Mumbai (sample)',
        available: true,
        disclaimer:
          'SAMPLE DEMONSTRATION DATA — not from any meteorological service. Enable live mode for the Open-Meteo research archive.',
      },
      isSample: true,
    };
  }
  try {
    const res = await fetchClimate(place);
    return { result: mapClimate(res, place), isSample: false };
  } catch {
    return {
      result: {
        points: [],
        monthly: [],
        location: place,
        available: false,
        note: 'The research climate archive could not be reached. No trend data is shown rather than guessed.',
      },
      isSample: false,
    };
  }
}
