import React from 'react';
import type { WeatherAlert } from '../../types';
import { SourceBadge } from '../common/SourceBadge';
import { Clock, MapPin, ChevronRight, Quote } from 'lucide-react';
import { useWeatherStore } from '../../store/useWeatherStore';

interface AlertCardProps {
  alert: WeatherAlert;
  /** Expired alerts render in a muted, explicitly-labelled transparency style. */
  expired?: boolean;
}

/** Map the backend's verbatim CAP severity (and legacy sample buckets) to badge styling. */
export function capSeverityStyle(severity?: string): { cls: string; label: string } {
  switch (severity) {
    case 'Extreme':
      return { cls: 'bg-red-200 text-red-900 border-red-400', label: '🔴 EXTREME' };
    case 'Severe':
      return { cls: 'bg-red-100 text-red-800 border-red-300', label: '🔴 SEVERE' };
    case 'Moderate':
      return { cls: 'bg-amber-100 text-amber-800 border-amber-300', label: '🟠 MODERATE' };
    case 'Minor':
      return { cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: '🟡 MINOR' };
    case 'WARNING':
      return { cls: 'bg-red-100 text-red-800 border-red-300', label: '🔴 WARNING (sample)' };
    case 'ALERT':
      return { cls: 'bg-amber-100 text-amber-800 border-amber-300', label: '🟠 ALERT (sample)' };
    case 'WATCH':
      return { cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: '🟡 WATCH (sample)' };
    default:
      return { cls: 'bg-gray-100 text-gray-700 border-gray-300', label: severity || 'UNKNOWN' };
  }
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, expired = false }) => {
  const { setActiveAlertModal } = useWeatherStore();
  const sev = capSeverityStyle(alert.severity);

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3.5 transition-colors relative overflow-hidden ${
        expired ? 'border-gray-300 opacity-75' : 'border-[#DCEAE2] hover:border-[#6BAF92]'
      }`}
    >
      {expired && (
        <div className="bg-gray-100 text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 text-[11px] font-semibold">
          EXPIRED · shown for transparency only — not current guidance
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${sev.cls}`}>
          {sev.label}
        </span>
        <SourceBadge source={alert.source} size="sm" />
      </div>

      <div>
        <h3 className="font-bold text-base text-[#17352A] leading-snug">{alert.title}</h3>
        <p className="text-xs text-[#6B7D74] flex items-center gap-1 mt-1">
          <MapPin className="w-3.5 h-3.5 text-[#2E7D5B]" /> {alert.affectedArea}
        </p>
        {(alert.urgency || alert.certainty) && (
          <p className="text-[11px] text-[#6B7D74] mt-1">
            {alert.urgency && <span>Urgency: <strong>{alert.urgency}</strong></span>}
            {alert.certainty && <span> · Certainty: <strong>{alert.certainty}</strong></span>}
          </p>
        )}
      </div>

      {alert.officialMessage && (
        <p className="text-xs text-[#17352A] bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2] leading-relaxed">
          {alert.officialMessage}
        </p>
      )}

      {/* The authority's verbatim instruction — quoted, never paraphrased. */}
      {alert.instruction && (
        <div className="bg-red-50/60 border border-red-200 rounded-xl p-3 text-xs text-red-950">
          <div className="flex items-center gap-1.5 font-bold text-red-700 mb-1">
            <Quote className="w-3.5 h-3.5" /> Official instruction (quoted verbatim)
          </div>
          <p className="leading-relaxed font-medium">“{alert.instruction}”</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7D74] border-t border-[#DCEAE2] pt-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {expired ? 'Expired' : 'Valid'}: {alert.issueTime || '—'} → {alert.expiryTime || '—'}
        </span>

        <button
          onClick={() => setActiveAlertModal(alert)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D5B] hover:underline"
        >
          <span>View details</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
