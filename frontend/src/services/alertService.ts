/**
 * alertService.ts — official NDMA/SACHET alerts for a location.
 *
 * Real data: POST /api/query returns evidence.alerts (active, relevance-verified official
 * CAP alerts) and recent_expired (labelled transparency). The frontend never decides alert
 * status. Demo mode returns bundled SAMPLE alerts, clearly badged.
 */
import type { WeatherAlert } from '../types';
import { MOCK_ALERTS } from '../mocks/alerts';
import { queryBackend } from './backendClient';
import { mapAlerts } from './mappers';

export interface AlertLookup {
  active: WeatherAlert[];
  expired: WeatherAlert[];
  alertsState?: string;
  alertsError?: string;
  isSample: boolean;
}

function sampleAlerts(locationId?: string): AlertLookup {
  const items = (locationId
    ? MOCK_ALERTS.filter(
        (a) =>
          (a.locationId ?? '').toLowerCase() === locationId.toLowerCase() || a.locationId === 'all',
      )
    : MOCK_ALERTS
  ).map((a) => ({ ...a, source: 'SAMPLE DATA', isOfficial: false, isSample: true }));
  return { active: items, expired: [], alertsState: 'sample', isSample: true };
}

export async function getActiveAlerts(
  locationId?: string,
  useDemo = false,
  locationHint?: string,
): Promise<AlertLookup> {
  if (useDemo) return sampleAlerts(locationId);
  const res = await queryBackend({
    message: `Are there any official weather alerts or warnings for ${locationHint || locationId || 'this area'}?`,
    locationHint: locationHint || locationId,
    conversational: false,
  });
  const { active, expired } = mapAlerts(res.evidence);
  return {
    active,
    expired,
    alertsState: res.evidence.alerts?.state,
    alertsError: res.evidence.alerts?.error ?? undefined,
    isSample: false,
  };
}
