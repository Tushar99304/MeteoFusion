import React from 'react';
import type { WeatherAlert } from '../../types';
import { SourceBadge } from '../common/SourceBadge';
import { Clock, MapPin, ChevronRight, Quote } from 'lucide-react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { capSeverityStyle } from '../../utils/alertStyles';

interface AlertCardProps {
  alert: WeatherAlert;
  /** Expired alerts render in a muted, explicitly-labelled transparency style. */
  expired?: boolean;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, expired = false }) => {
  const { setActiveAlertModal } = useWeatherStore();
  const sev = capSeverityStyle(alert.severity);

  return (
    <div
      className={`card-3d bg-white rounded-3xl p-5 sm:p-6 border transition-all space-y-4 relative overflow-hidden ${
        expired ? 'border-slate-300 opacity-75' : 'border-[#D7E7F5] hover:border-[#3B82F6]'
      }`}
    >
      {expired && (
        <div className="bg-slate-100 text-slate-700 border border-slate-300 rounded-xl px-3 py-1.5 text-[11px] font-bold">
          EXPIRED ON RECORD · Historical record for transparency — not active guidance
        </div>
      )}
      
      <div className="flex items-center justify-between gap-2">
        <span className={`px-2.5 py-1 rounded-lg text-xs border ${sev.cls}`}>
          {sev.label}
        </span>
        <SourceBadge source={alert.source} size="sm" />
      </div>

      <div>
        <h3 className="font-extrabold text-base text-[#0F2742] leading-snug">{alert.title}</h3>
        <p className="text-xs text-[#5D7188] flex items-center gap-1.5 mt-1 font-medium">
          <MapPin className="w-3.5 h-3.5 text-[#3B82F6]" /> {alert.affectedArea}
        </p>
        {(alert.urgency || alert.certainty) && (
          <p className="text-[11px] text-[#5D7188] font-mono-stat mt-1">
            {alert.urgency && <span>Urgency: <strong className="text-[#0F2742]">{alert.urgency}</strong></span>}
            {alert.certainty && <span> • Certainty: <strong className="text-[#0F2742]">{alert.certainty}</strong></span>}
          </p>
        )}
      </div>

      {alert.officialMessage && (
        <p className="text-xs text-[#0F2742] bg-[#F5FAFF] p-3.5 rounded-2xl border border-[#D7E7F5] leading-relaxed">
          {alert.officialMessage}
        </p>
      )}

      {/* The authority's verbatim instruction — quoted, never paraphrased. */}
      {alert.instruction && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-950">
          <div className="flex items-center gap-1.5 font-bold text-rose-700 mb-1">
            <Quote className="w-3.5 h-3.5 text-rose-500" /> Official NDMA instruction (verbatim)
          </div>
          <p className="leading-relaxed font-semibold">“{alert.instruction}”</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5D7188] border-t border-[#D7E7F5] pt-3.5 font-mono-stat">
        <span className="flex items-center gap-1 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
          {expired ? 'Expired' : 'Valid'}: {alert.issueTime || '—'} → {alert.expiryTime || '—'}
        </span>

        <button
          onClick={() => setActiveAlertModal(alert)}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#1557B0] hover:underline font-sans"
        >
          <span>Examine CAP payload</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
