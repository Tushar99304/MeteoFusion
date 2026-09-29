export interface DataSourceDetail {
  id: string;
  name: string;
  fullName: string;
  role: string;
  authorityLevel: 'OFFICIAL' | 'DISASTER' | 'SECONDARY_MODEL' | 'NOT_WIRED';
  status: 'LIVE' | 'REGISTRY_STUB' | 'NOT_CONNECTED';
  description: string;
  dataProvided: string[];
}

/**
 * Source descriptions reflect THIS build honestly:
 *  - NDMA SACHET is live and is the only OFFICIAL authority.
 *  - Open-Meteo is live as research/reproducibility model data.
 *  - IMD has no live feed wired in (the provider registry reserves an IMD hook for approved
 *    access); GFS is only available as model blends via Open-Meteo, not as a standalone feed.
 * Nothing claims a connected IMD feed.
 */
export const DATA_SOURCES: DataSourceDetail[] = [
  {
    id: 'ndma',
    name: 'NDMA SACHET',
    fullName: 'National Disaster Management Authority — SACHET CAP alerts',
    role: 'Official early-warning & disaster alert source (CAP/RSS)',
    authorityLevel: 'OFFICIAL',
    status: 'LIVE',
    description:
      'Official Common Alerting Protocol bulletins for India. Active alerts relevant to the resolved location are surfaced first and always take precedence over model weather. Only relevance-verified alerts are attached; expired records are shown for transparency only.',
    dataProvided: ['Official disaster alerts', 'Verbatim CAP instructions', 'Severity / urgency / certainty', 'Alert validity window'],
  },
  {
    id: 'openmeteo',
    name: 'Open-Meteo',
    fullName: 'Open-Meteo Forecast & Historical Archive APIs',
    role: 'Current conditions, forecast and reanalysis — research/reproducibility',
    authorityLevel: 'SECONDARY_MODEL',
    status: 'LIVE',
    description:
      'Free model weather used for current conditions, short forecasts, hourly data and the reanalysis climate archive. Labelled research/reproducibility: it is not an official forecast and the exact request URL is recorded in evidence for reproducibility.',
    dataProvided: ['Current conditions', 'Daily + hourly forecast', 'Reanalysis climate trends'],
  },
  {
    id: 'imd',
    name: 'IMD',
    fullName: 'India Meteorological Department',
    role: 'Intended official weather provider once API access is approved',
    authorityLevel: 'NOT_WIRED',
    status: 'NOT_CONNECTED',
    description:
      'IMD is the national meteorological authority and the intended primary source, but no live IMD data feed is wired into this build. The provider registry reserves an IMD hook; until official access is configured, model weather is labelled Open-Meteo (research/repro) and no numbers are attributed to IMD.',
    dataProvided: ['(not connected in this build)'],
  },
  {
    id: 'gfs',
    name: 'GFS / NCEP',
    fullName: 'Global Forecast System (NOAA/NCEP)',
    role: 'Global NWP model — reachable only as a model selection via Open-Meteo',
    authorityLevel: 'SECONDARY_MODEL',
    status: 'REGISTRY_STUB',
    description:
      'A GFS provider is registered as an architecture-ready stub in the backend. It is not fetched directly; Open-Meteo can optionally serve a GFS seamless blend, which is still labelled research/reproducibility model data.',
    dataProvided: ['Model blend (via Open-Meteo optional)'],
  },
];
