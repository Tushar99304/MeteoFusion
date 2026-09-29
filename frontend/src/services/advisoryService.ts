/**
 * advisoryService.ts — sector advisory (deterministic backend risk engine).
 *
 * The backend advisory is authoritative. The frontend asks /api/query with an `activity`
 * parameter (driving/marine/agriculture/...); the backend applies the SAME validated
 * evidence, thresholds and alert precedence and returns the advisory. The frontend does
 * not compute risk. Demo mode returns bundled SAMPLE advisories, clearly badged.
 */
import type { ActivityCategory, WeatherAdvisory } from '../types';
import { MOCK_ADVISORIES } from '../mocks/advisory';
import { queryBackend } from './backendClient';
import { mapAdvisory } from './mappers';

/** Map the UI's tab labels to the backend activity vocabulary. */
export function activityKey(category: ActivityCategory | string): string {
  const map: Record<string, string> = {
    Driving: 'driving',
    Travel: 'travel',
    'Outdoor Event': 'outdoor event',
    Trekking: 'trekking',
    Agriculture: 'agriculture',
    Marine: 'marine',
    'Daily Activity': 'daily activity',
  };
  return map[category] || String(category).toLowerCase();
}

export async function getAdvisoryForActivity(
  category: ActivityCategory | string,
  locationName = 'Mumbai',
  useDemo = false,
): Promise<{ advisory: WeatherAdvisory; isSample: boolean }> {
  if (useDemo) {
    const base = MOCK_ADVISORIES[category as ActivityCategory] || MOCK_ADVISORIES['Driving'];
    return {
      advisory: {
        ...base,
        location: `${locationName} area`,
        isSample: true,
        category,
      },
      isSample: true,
    };
  }
  const activity = activityKey(category);
  const res = await queryBackend({
    message: `Is it safe for ${activity} in ${locationName}? Give the weather-related risk.`,
    locationHint: locationName,
    activity,
    conversational: false,
  });
  const advisory =
    mapAdvisory(
      res.evidence.advisory ?? null,
      res.evidence.location
        ? [res.evidence.location.name, res.evidence.location.admin1]
            .filter(Boolean)
            .join(', ')
        : locationName,
      category,
    ) ?? undefined;
  // If the backend abstained/clarified, surface that as an UNCERTAIN advisory view rather
  // than fabricating one.
  const fallback: WeatherAdvisory = {
    category,
    location: locationName,
    riskLevel: 'UNCERTAIN',
    primaryRiskReason:
      res.evidence.abstain_reason ||
      res.evidence.clarification ||
      'Risk could not be determined from verified evidence.',
    detailedReasons: [],
    recommendation: res.evidence.abstain_reason || res.evidence.clarification || '',
    officialWarningActive: false,
    isSample: false,
  };
  return { advisory: advisory ?? fallback, isSample: false };
}
