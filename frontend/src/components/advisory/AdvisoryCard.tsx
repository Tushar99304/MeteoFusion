import React from 'react';
import type { WeatherAdvisory } from '../../types';
import { AlertTriangle, Car, Compass, Anchor, Tent, Sprout, Calendar, FlaskConical, ShieldAlert } from 'lucide-react';

interface AdvisoryCardProps {
  advisory: WeatherAdvisory;
  isSample?: boolean;
}

export const AdvisoryCard: React.FC<AdvisoryCardProps> = ({ advisory, isSample = advisory.isSample }) => {
  let riskColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let riskLabel = 'LOW RISK';

  if (advisory.riskLevel === 'MEDIUM') {
    riskColor = 'bg-amber-50 text-amber-900 border-amber-300';
    riskLabel = 'MODERATE RISK';
  } else if (advisory.riskLevel === 'HIGH') {
    riskColor = 'bg-rose-50 text-rose-900 border-rose-300';
    riskLabel = 'HIGH RISK';
  } else if (advisory.riskLevel === 'UNCERTAIN') {
    riskColor = 'bg-slate-100 text-slate-800 border-slate-300';
    riskLabel = 'RISK UNCERTAIN';
  }

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'Driving':
        return <Car className="w-5 h-5 text-[#3B82F6]" />;
      case 'Trekking':
        return <Tent className="w-5 h-5 text-[#3B82F6]" />;
      case 'Agriculture':
        return <Sprout className="w-5 h-5 text-[#3B82F6]" />;
      case 'Marine':
        return <Anchor className="w-5 h-5 text-[#3B82F6]" />;
      case 'Outdoor Event':
        return <Calendar className="w-5 h-5 text-[#3B82F6]" />;
      default:
        return <Compass className="w-5 h-5 text-[#3B82F6]" />;
    }
  };

  return (
    <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 lg:p-8 shadow-xs space-y-5">
      {isSample && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
          <FlaskConical className="w-3.5 h-3.5 text-amber-600" /> SAMPLE DEMO DATA — not a live advisory.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E7F5] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#DCEEFF] border border-[#BFDBFE]">
            {renderCategoryIcon(advisory.category)}
          </div>
          <div>
            <h3 className="font-extrabold text-xl text-[#0F2742] tracking-tight">{advisory.category} Advisory</h3>
            <p className="text-xs text-[#5D7188] font-medium">
              Location: <strong>{advisory.location}</strong>
              {advisory.activity ? ` • Context: ${advisory.activity}` : ''}
            </p>
          </div>
        </div>

        <span className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border ${riskColor}`}>
          Deterministic Risk: {riskLabel}
        </span>
      </div>

      {advisory.officialWarningActive && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-4 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>
            An active official NDMA SACHET alert applies to this geographic coordinate and takes precedence over all model weather interpretation. Alert id(s): {advisory.alertIds?.join(', ') || '—'}
          </span>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#5D7188] uppercase tracking-wider">Evaluation Factors & Grounding</h4>
        <div className="bg-[#F5FAFF] border border-[#D7E7F5] p-5 rounded-2xl space-y-3">
          <p className="text-sm font-extrabold text-[#0F2742] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{advisory.primaryRiskReason}</span>
          </p>
          {advisory.detailedReasons.length > 0 && (
            <ul className="space-y-2 pt-2 border-t border-[#D7E7F5] text-xs text-[#5D7188]">
              {advisory.detailedReasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0"></span>
                  <span className="leading-relaxed">{reason}</span>
                </li>
              ))}
            </ul>
          )}
          {advisory.rulesFired && advisory.rulesFired.length > 0 && (
            <div className="pt-2 border-t border-[#D7E7F5] flex flex-wrap gap-1.5 text-[10px] text-[#5D7188] font-mono-stat">
              <span className="font-bold">Rules Evaluated:</span>
              {advisory.rulesFired.map((rule, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-[#D7E7F5] text-[#1557B0]">
                  {rule}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {advisory.recommendation && (
        <div className="p-4 rounded-2xl bg-[#DCEEFF]/50 border border-[#BFDBFE] text-xs text-[#1557B0] leading-relaxed">
          <strong className="text-[#0F2742] block mb-1">Operational Recommendation:</strong>
          {advisory.recommendation}
        </div>
      )}
    </div>
  );
};
