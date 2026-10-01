/** Map the backend's verbatim CAP severity (and legacy sample buckets) to badge styling. */
export function capSeverityStyle(severity?: string): { cls: string; label: string } {
  switch (severity) {
    case 'Extreme':
      return { cls: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold', label: '🔴 EXTREME' };
    case 'Severe':
      return { cls: 'bg-rose-50 text-rose-800 border-rose-200 font-bold', label: '🔴 SEVERE' };
    case 'Moderate':
      return { cls: 'bg-amber-50 text-amber-800 border-amber-200 font-bold', label: '🟠 MODERATE' };
    case 'Minor':
      return { cls: 'bg-blue-50 text-blue-800 border-blue-200 font-bold', label: '🟡 MINOR' };
    case 'WARNING':
      return { cls: 'bg-rose-100 text-rose-900 border-rose-300 font-bold', label: '🔴 WARNING (demo)' };
    case 'ALERT':
      return { cls: 'bg-amber-50 text-amber-800 border-amber-200 font-bold', label: '🟠 ALERT (demo)' };
    case 'WATCH':
      return { cls: 'bg-blue-50 text-blue-800 border-blue-200 font-bold', label: '🟡 WATCH (demo)' };
    default:
      return { cls: 'bg-slate-50 text-slate-700 border-slate-200 font-medium', label: severity || 'UNKNOWN' };
  }
}
