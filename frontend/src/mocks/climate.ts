import type { ClimateDataPoint } from '../types';

export const MOCK_CLIMATE_ANNUAL: ClimateDataPoint[] = [
  { year: 2019, rainfallActual: 3470, rainfallNormal: 2400, tempAvg: 27.2, tempAnomaly: 0.4, extremeEventsCount: 14 },
  { year: 2020, rainfallActual: 3680, rainfallNormal: 2400, tempAvg: 27.1, tempAnomaly: 0.3, extremeEventsCount: 16 },
  { year: 2021, rainfallActual: 3120, rainfallNormal: 2400, tempAvg: 27.5, tempAnomaly: 0.7, extremeEventsCount: 12 },
  { year: 2022, rainfallActual: 2980, rainfallNormal: 2400, tempAvg: 27.6, tempAnomaly: 0.8, extremeEventsCount: 11 },
  { year: 2023, rainfallActual: 3050, rainfallNormal: 2400, tempAvg: 27.9, tempAnomaly: 1.1, extremeEventsCount: 15 },
  { year: 2024, rainfallActual: 3290, rainfallNormal: 2400, tempAvg: 28.1, tempAnomaly: 1.3, extremeEventsCount: 18 },
  { year: 2025, rainfallActual: 3410, rainfallNormal: 2400, tempAvg: 28.3, tempAnomaly: 1.5, extremeEventsCount: 19 },
];

export const MOCK_CLIMATE_MONTHLY: ClimateDataPoint[] = [
  { year: 2026, month: 'Jan', rainfallActual: 2.1, rainfallNormal: 0.6, tempAvg: 24.2, tempAnomaly: 0.2, extremeEventsCount: 0 },
  { year: 2026, month: 'Feb', rainfallActual: 1.0, rainfallNormal: 1.3, tempAvg: 25.5, tempAnomaly: 0.5, extremeEventsCount: 0 },
  { year: 2026, month: 'Mar', rainfallActual: 0.2, rainfallNormal: 0.2, tempAvg: 27.8, tempAnomaly: 0.8, extremeEventsCount: 1 },
  { year: 2026, month: 'Apr', rainfallActual: 4.5, rainfallNormal: 1.5, tempAvg: 30.1, tempAnomaly: 0.9, extremeEventsCount: 1 },
  { year: 2026, month: 'May', rainfallActual: 18.2, rainfallNormal: 12.5, tempAvg: 31.5, tempAnomaly: 1.2, extremeEventsCount: 2 },
  { year: 2026, month: 'Jun', rainfallActual: 520.0, rainfallNormal: 493.1, tempAvg: 29.2, tempAnomaly: 0.6, extremeEventsCount: 4 },
  { year: 2026, month: 'Jul', rainfallActual: 845.0, rainfallNormal: 840.7, tempAvg: 27.8, tempAnomaly: 0.4, extremeEventsCount: 6 },
  { year: 2026, month: 'Aug', rainfallActual: 610.0, rainfallNormal: 585.2, tempAvg: 27.5, tempAnomaly: 0.5, extremeEventsCount: 3 },
  { year: 2026, month: 'Sep', rainfallActual: 380.0, rainfallNormal: 341.4, tempAvg: 27.9, tempAnomaly: 0.7, extremeEventsCount: 2 },
  { year: 2026, month: 'Oct', rainfallActual: 95.0, rainfallNormal: 89.3, tempAvg: 28.5, tempAnomaly: 0.9, extremeEventsCount: 0 },
  { year: 2026, month: 'Nov', rainfallActual: 12.0, rainfallNormal: 14.5, tempAvg: 27.1, tempAnomaly: 0.4, extremeEventsCount: 0 },
  { year: 2026, month: 'Dec', rainfallActual: 3.5, rainfallNormal: 2.1, tempAvg: 25.0, tempAnomaly: 0.3, extremeEventsCount: 0 },
];
