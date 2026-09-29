import React from 'react';
import type { WeatherAdvisory } from '../../types';
import { AlertTriangle, CheckCircle2, Car, Compass, Anchor, Tent, Sprout, Calendar, FlaskConical, ShieldAlert } from 'lucide-react';

interface AdvisoryCardProps {
  advisory: WeatherAdvisory;
  isSample?: boolean;
}

export const AdvisoryCard: React.FC<AdvisoryCardProps> = ({ advisory, isSample = advisory.isSample }) => {
  let riskColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
  let riskLabel = 'LOW RISK';

  if (advisory.riskLevel === 'MEDIUM') {
    riskColor = 'bg-amber-100 text-amber-900 border-amber-300';
    riskLabel = 'MODERATE RISK';
  } else if (advisory.riskLevel === 'HIGH') {
    riskColor = 'bg-red-100 text-red-950 border-red-300';
    riskLabel = 'HIGH RISK';
  } else if (advisory.riskLevel === 'UNCERTAIN') {
    riskColor = 'bg-gray-200 text-gray-800 border-gray-400';
    riskLabel = 'RISK UNCERTAIN';
  }

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'Driving':
        return <Car className="w-5 h-5 text-[#2E7D5B]" />;
      case 'Trekking':
        return <Tent className="w-5 h-5 text-[#2E7D5B]" />;
      case 'Agriculture':
        return <Sprout className="w-5 h-5 text-[#2E7D5B]" />;
      case 'Marine':
        return <Anchor className="w-5 h-5 text-[#2E7D5B]" />;
      case 'Outdoor Event':
        return <Calendar className="w-5 h-5 text-[#2E7D5B]" />;
      default:
        return <Compass className="w-5 h-5 text-[#2E7D5B]" />;
    }
  };

  return (
    <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 shadow-xs space-y-4">
      {isSample && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
          <FlaskConical className="w-3.5 h-3.5" /> SAMPLE DEMO DATA — not a live advisory.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCEAE2] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E8F5EE] border border-[#6BAF92]/40">
            {renderCategoryIcon(advisory.category)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#17352A]">{advisory.category} Advisory</h3>
            <p className="text-xs text-[#6B7D74]">
              {advisory.location}
              {advisory.activity ? ` • context: ${advisory.activity}` : ''}
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-lg text-xs font-extrabold border ${riskColor}`}>
          Weather-related risk: {riskLabel}
        </span>
      </div>

      {advisory.officialWarningActive && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>
            An active official NDMA/SACHET alert applies to this location and outranks all
            model-weather interpretation. Alert id(s): {advisory.alertIds?.join(', ') || '—'}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#17352A] uppercase tracking-wider">Risk basis & factors</h4>
        <div className="bg-[#F7FBF8] border border-[#DCEAE2] p-4 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-[#17352A] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{advisory.primaryRiskReason}</span>
          </p>
          {advisory.detailedReasons.length > 0 && (
            <ul className="space-y-1.5 pt-2 border-t border-[#DCEAE2]/60 text-xs text-[#6B7D74]">
              {advisory.detailedReasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] mt-1.5 shrink-0"></span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
          {advisory.rulesFired && advisory.rulesFired.length > 0 && (
            <p className="pt-2 border-t border-[#DCEAE2]/60 text-[10px] text-[#6B7D74] font-mono">
              deterministic rules: {advisory.rulesFired.join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#17352A] uppercase tracking-wider">What this means</h4>
        <div className="bg-[#E8F5EE] border border-[#6BAF92]/40 p-4 rounded-xl text-xs text-[#17352A] leading-relaxed font-medium flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2E7D5B] shrink-0 mt-0.5" />
          <div>
            <p>{advisory.recommendation}</p>
            <p className="text-[11px] text-[#6B7D74] mt-2 font-normal">
              {advisory.disclaimer ||
                'Weather-related risk estimate from validated evidence — not an official order, evacuation instruction, or guarantee of personal safety.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
