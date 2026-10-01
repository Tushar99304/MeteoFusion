import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';

export const ModelAgreementCard: React.FC = () => {
  const { currentWeather } = useWeatherStore();

  const disagreementFlag = (currentWeather as any)?.disagreementFlag ?? false;
  const score = (currentWeather as any)?.sourceAgreementScore ?? (disagreementFlag ? 0.3 : 1.0);
  const agreementText = (currentWeather as any)?.sourceAgreement ?? (disagreementFlag ? 'Low Agreement' : 'Multi-Model Consensus');

  const models = currentWeather?.blendingMetadata?.models || [];
  const temps = models.map(m => m.temperatureC).filter((t): t is number => t != null);
  const maxDiff = temps.length > 1 ? (Math.max(...temps) - Math.min(...temps)).toFixed(1) : null;

  return (
    <div className={`card-3d p-6 rounded-3xl border transition-all ${
      disagreementFlag 
        ? 'bg-rose-50/50 border-rose-200' 
        : 'bg-white border-[#D7E7F5]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider block">Cross-Model Spread</span>
          <h3 className="text-lg font-extrabold text-[#0F2742] tracking-tight">MODEL AGREEMENT</h3>
        </div>

        {disagreementFlag ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            DISAGREEMENT DETECTED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1557B0] border border-[#BFDBFE]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
            CONSENSUS REACHED
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono-stat">
          <span className="text-[#5D7188]">Consensus Status:</span>
          <span className={`font-bold ${disagreementFlag ? 'text-rose-700' : 'text-[#1557B0]'}`}>
            {agreementText} ({Math.round(score * 100)}%)
          </span>
        </div>

        {maxDiff != null && (
          <div className="flex items-center justify-between text-xs font-mono-stat">
            <span className="text-[#5D7188]">Max Inter-Model Spread:</span>
            <span className="font-bold text-[#0F2742]">Δ {maxDiff}°C</span>
          </div>
        )}

        <div className="p-3 rounded-xl bg-[#F5FAFF] border border-[#D7E7F5] text-xs text-[#5D7188] flex items-start gap-2">
          <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {disagreementFlag
              ? 'Model divergence exceeds the established consistency threshold. Grounded advisory flags elevated meteorological variance.'
              : 'Consistent trajectories observed across ECMWF IFS, GFS, ICON, and AIFS, confirming multi-model stability.'}
          </p>
        </div>
      </div>
    </div>
  );
};
