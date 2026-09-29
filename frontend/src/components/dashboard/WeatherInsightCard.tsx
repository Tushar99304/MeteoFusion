import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { SourceBadge } from '../common/SourceBadge';
import { Sparkles, ShieldCheck, Info } from 'lucide-react';

/**
 * "Synthesis" card. It shows the backend's DETERMINISTIC advisory headline/reason for the
 * current location — not a sentence the frontend writes. When no advisory is loaded yet we
 * say so plainly rather than inventing a forecast narrative.
 */
export const WeatherInsightCard: React.FC = () => {
  const { advisory, currentWeather, usingSample } = useWeatherStore();

  const headline = advisory?.primaryRiskReason;
  const reason = advisory?.recommendation;
  const quality = advisory?.riskLevel;

  return (
    <div className="bg-[#E8F5EE] border border-[#6BAF92]/40 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2E7D5B] text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#17352A]">Deterministic risk advisory</h3>
            <span className="text-[11px] text-[#6B7D74]">
              Computed by the backend from validated evidence — never by the LLM
            </span>
          </div>
        </div>
        <SourceBadge source={currentWeather?.source || 'Open-Meteo'} authority={currentWeather?.authority} size="sm" />
      </div>

      {headline ? (
        <div className="space-y-2">
          <p className="text-sm text-[#17352A] leading-relaxed font-medium bg-white/80 p-3.5 rounded-xl border border-[#DCEAE2]">
            “{headline}”
          </p>
          {reason && (
            <p className="text-xs text-[#6B7D74] leading-relaxed bg-white/60 p-3 rounded-xl border border-[#DCEAE2]">
              {reason}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#6B7D74] bg-white/60 p-3 rounded-xl border border-[#DCEAE2] flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#2E7D5B]" />
          Loading the deterministic advisory for this location. If evidence is insufficient the
          backend will say so rather than guess.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[#DCEAE2]/60">
        <div className="flex items-center gap-2">
          <span className="text-[#6B7D74] font-medium">Weather-related risk:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-white text-[#2E7D5B] font-bold border border-[#6BAF92]/40">
            {quality ?? '—'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[#6B7D74]">
          <ShieldCheck className="w-4 h-4 text-[#2E7D5B]" />
          {usingSample ? (
            <span>Sample demo data — not a live source</span>
          ) : (
            <span>
              {advisory?.officialWarningActive
                ? 'Active official NDMA/SACHET alert outranks model weather'
                : 'Official alerts checked; model data is research/repro'}
            </span>
          )}
        </div>
      </div>

      {advisory?.disclaimer && (
        <p className="text-[10px] text-[#6B7D74] leading-relaxed">{advisory.disclaimer}</p>
      )}
    </div>
  );
};
