export function formatTemp(tempC: number, unit: '°C' | '°F' = '°C'): string {
  if (unit === '°F') {
    const tempF = Math.round((tempC * 9) / 5 + 32);
    return `${tempF}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

export function formatWind(windKmH: number, unit: 'km/h' | 'm/s' = 'km/h'): string {
  if (unit === 'm/s') {
    const ms = (windKmH / 3.6).toFixed(1);
    return `${ms} m/s`;
  }
  return `${Math.round(windKmH)} km/h`;
}

export function getSeverityBadgeColor(severity: string) {
  switch (severity) {
    case 'WARNING':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'ALERT':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'WATCH':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }
}
