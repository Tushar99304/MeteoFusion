import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { Cpu, Wind, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const WeightedBlendPipeline: React.FC = () => {
  const { currentWeather } = useWeatherStore();
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const blending = currentWeather?.blendingMetadata;
  const models = blending?.models || [
    { modelName: 'ECMWF IFS HRES', weight: 0.2828, modelType: 'NWP', temperatureC: 30.8 },
    { modelName: 'NCEP GFS', weight: 0.1292, modelType: 'NWP', temperatureC: 32.1 },
    { modelName: 'DWD ICON Global', weight: 0.2954, modelType: 'NWP', temperatureC: 30.6 },
    { modelName: 'ECMWF AIFS', weight: 0.2926, modelType: 'AI/ML', temperatureC: 31.0 },
  ];

  const calib = blending?.calibrationMetadata;

  return (
    <div className="card-3d p-6 lg:p-8 bg-white border border-[#D7E7F5] rounded-3xl relative overflow-hidden shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#DCEEFF] text-[#1557B0]">
              <Sparkles className="w-4 h-4 text-[#3B82F6]" />
            </span>
            <h2 className="text-xl font-extrabold text-[#0F2742] tracking-tight">Multi-Model Blending Pipeline</h2>
          </div>
          <p className="text-xs text-[#5D7188] mt-1">
            Real-time multi-model synthesis from NWP & AI/ML physics to grounded hybrid output
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono-stat text-[#5D7188] bg-[#F5FAFF] px-2.5 py-1 rounded-lg border border-[#D7E7F5]">
            Inverse-MAE Engine
          </span>
        </div>
      </div>

      {/* Graphical Flow Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: 4 Models Column (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider mb-2">
            1. Member Models & NWP Nodes
          </div>
          {models.map((m) => {
            const isHovered = activeModel === m.modelName;
            const isAI = m.modelType === 'AI/ML';
            const weightPct = (m.weight * 100).toFixed(1);
            const mae = calib?.mae?.[m.modelName];

            return (
              <div
                key={m.modelName}
                onMouseEnter={() => setActiveModel(m.modelName)}
                onMouseLeave={() => setActiveModel(null)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  isHovered
                    ? 'border-[#3B82F6] bg-[#DCEEFF]/50 shadow-md transform -translate-x-1'
                    : 'border-[#D7E7F5] bg-[#F5FAFF] hover:border-[#BFDBFE]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isAI ? (
                      <Cpu className="w-4 h-4 text-[#06B6D4]" />
                    ) : (
                      <Wind className="w-4 h-4 text-[#3B82F6]" />
                    )}
                    <div>
                      <span className="font-bold text-xs text-[#0F2742] block">{m.modelName}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                          isAI ? 'bg-cyan-100 text-cyan-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {m.modelType || 'NWP'}
                        </span>
                        {mae != null && (
                          <span className="text-[10px] text-[#5D7188] font-mono-stat">
                            MAE: {mae.toFixed(3)}°C
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-stat font-extrabold text-sm text-[#1557B0]">
                      {weightPct}%
                    </span>
                    <span className="block text-[10px] text-[#5D7188] font-mono-stat">
                      {m.temperatureC != null ? formatTemp(m.temperatureC, '°C') : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center: Connectors & Adaptive Weight Engine (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4">
          <div className="w-full relative flex flex-col items-center">
            {/* SVG Connecting Flow Lines for Desktop */}
            <div className="hidden lg:block w-full h-24 mb-2">
              <svg className="w-full h-full" viewBox="0 0 200 80" fill="none">
                <path
                  d="M 10 15 C 60 15, 80 40, 190 40"
                  stroke={activeModel === models[0]?.modelName ? '#3B82F6' : '#CBDFF2'}
                  strokeWidth={activeModel === models[0]?.modelName ? '2.5' : '1.5'}
                  className="animate-data-flow"
                />
                <path
                  d="M 10 32 C 60 32, 80 40, 190 40"
                  stroke={activeModel === models[1]?.modelName ? '#3B82F6' : '#CBDFF2'}
                  strokeWidth={activeModel === models[1]?.modelName ? '2.5' : '1.5'}
                  className="animate-data-flow"
                />
                <path
                  d="M 10 48 C 60 48, 80 40, 190 40"
                  stroke={activeModel === models[2]?.modelName ? '#3B82F6' : '#CBDFF2'}
                  strokeWidth={activeModel === models[2]?.modelName ? '2.5' : '1.5'}
                  className="animate-data-flow"
                />
                <path
                  d="M 10 65 C 60 65, 80 40, 190 40"
                  stroke={activeModel === models[3]?.modelName ? '#3B82F6' : '#CBDFF2'}
                  strokeWidth={activeModel === models[3]?.modelName ? '2.5' : '1.5'}
                  className="animate-data-flow"
                />
              </svg>
            </div>

            {/* Central Weight Engine Node */}
            <div className="w-full p-4 rounded-2xl bg-gradient-to-br from-[#1557B0] to-[#1E40AF] text-white shadow-md text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-center gap-1.5 mb-1 text-cyan-300">
                <Sparkles className="w-4 h-4 animate-spin text-cyan-300" style={{ animationDuration: '8s' }} />
                <span className="text-[11px] font-extrabold uppercase tracking-wider">AI Weight Engine</span>
              </div>
              <div className="font-extrabold text-sm sm:text-base tracking-tight mb-1">
                Historical Skill Calibration
              </div>
              <p className="text-[11px] text-blue-100 font-mono-stat">
                skill = 1 / (MAE + ε)
              </p>
              <div className="mt-2.5 pt-2.5 border-t border-white/15 flex items-center justify-around text-[10px] text-blue-200 font-mono-stat">
                <span>ERA5 Reanalysis Reference</span>
                <span>•</span>
                <span>{blending?.region?.includes(',') ? 'Mumbai' : (blending?.region || 'Mumbai')} {blending?.calibrationMetadata?.leadTime || '+24h'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Blended Hybrid Output (4 cols) */}
        <div className="lg:col-span-4">
          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider mb-2">
            2. Verified Hybrid Output
          </div>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F5FAFF] via-white to-[#DCEEFF]/30 border-2 border-[#BFDBFE] shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#1557B0] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Hybrid Forecast
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Active Blend
              </span>
            </div>

            <div className="space-y-3 font-mono-stat">
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#D7E7F5]">
                <span className="text-[#5D7188]">Blended Temp:</span>
                <span className="font-extrabold text-[#0F2742] text-sm">
                  {blending?.blendedTemperatureC != null ? formatTemp(blending.blendedTemperatureC, '°C') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#D7E7F5]">
                <span className="text-[#5D7188]">Blended Rainfall:</span>
                <span className="font-extrabold text-[#0F2742] text-sm">
                  {blending?.blendedPrecipitationMm != null ? `${blending.blendedPrecipitationMm} mm` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#D7E7F5]">
                <span className="text-[#5D7188]">Blended Wind:</span>
                <span className="font-extrabold text-[#0F2742] text-sm">
                  {blending?.blendedWindSpeedKmh != null ? `${blending.blendedWindSpeedKmh} km/h` : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#5D7188]">Calibration Mode:</span>
                  <span className="font-bold text-emerald-700 text-right">
                    {blending?.calibrationMode === 'CALIBRATED'
                      ? 'CALIBRATED FOR SELECTED CONTEXT'
                      : (blending?.calibrationMode || 'CALIBRATED FOR SELECTED CONTEXT')}
                  </span>
                </div>
                <div className="text-[11px] text-right font-medium text-emerald-800">
                  {blending?.region?.includes(',') ? 'Mumbai' : (blending?.region || 'Mumbai')} • Temperature • {blending?.calibrationMetadata?.leadTime || '+24h'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
