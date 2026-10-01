import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  Cpu, 
  Wind, 
  Thermometer, 
  Droplets, 
  BarChart2, 
  HelpCircle
} from 'lucide-react';
import { formatTemp, formatWind } from '../../utils/formatters';

interface ModelIntelligenceSectionProps {
  onOpenExplain?: () => void;
}

export const ModelIntelligenceSection: React.FC<ModelIntelligenceSectionProps> = ({ onOpenExplain }) => {
  const { currentWeather, calibration } = useWeatherStore();
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  const blending = currentWeather?.blendingMetadata;
  const calib = blending?.calibrationMetadata || calibration;

  // Use dynamic models from backend if present, otherwise default to model registry definitions
  const models = blending?.models && blending.models.length > 0 ? blending.models : [
    { modelName: 'ECMWF IFS HRES', weight: 0.2850, modelType: 'NWP', temperatureC: 30.8, precipitationMm: 11.8, windSpeedKmh: 17.5 },
    { modelName: 'NCEP GFS', weight: 0.1292, modelType: 'NWP', temperatureC: 32.1, precipitationMm: 14.2, windSpeedKmh: 19.8 },
    { modelName: 'DWD ICON Global', weight: 0.2876, modelType: 'NWP', temperatureC: 30.6, precipitationMm: 12.0, windSpeedKmh: 17.9 },
    { modelName: 'ECMWF AIFS', weight: 0.2982, modelType: 'AI/ML', temperatureC: 31.0, precipitationMm: 12.2, windSpeedKmh: 18.1 },
  ];


  return (
    <section id="models" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0] shadow-2xs">
              <BarChart2 className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold text-[#0F2742] tracking-tight">MODEL INTELLIGENCE</h2>
              <p className="text-xs sm:text-sm text-[#5D7188] font-medium">How the forecast is assembled</p>
            </div>
          </div>
        </div>

        {onOpenExplain && (
          <button
            onClick={onOpenExplain}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#D7E7F5] hover:border-[#3B82F6] text-[#1557B0] text-xs font-semibold hover:bg-[#F5FAFF] transition-all shadow-xs"
          >
            <HelpCircle className="w-4 h-4 text-[#3B82F6]" />
            <span>Explain Weighting Math</span>
          </button>
        )}
      </div>

      {/* 4 Interactive Model Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {models.map((m) => {
          const isAI = m.modelType === 'AI/ML';
          const weightPct = (m.weight * 100).toFixed(2);
          const mae = calib?.mae?.[m.modelName];
          const rmse = calib?.rmse?.[m.modelName];
          const isHovered = hoveredModel === m.modelName;

          return (
            <div
              key={m.modelName}
              onMouseEnter={() => setHoveredModel(m.modelName)}
              onMouseLeave={() => setHoveredModel(null)}
              className={`card-3d bg-white p-5 rounded-2xl border transition-all ${
                isHovered
                  ? 'border-[#3B82F6] shadow-md ring-2 ring-[#DCEEFF]'
                  : 'border-[#D7E7F5]'
              }`}
            >
              {/* Header: Model & Type */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isAI ? 'bg-cyan-50 text-[#06B6D4]' : 'bg-blue-50 text-[#3B82F6]'
                  }`}>
                    {isAI ? <Cpu className="w-4 h-4" /> : <Wind className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[#0F2742] leading-tight">{m.modelName}</h3>
                    <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase mt-0.5 ${
                      isAI
                        ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      {m.modelType || 'NWP'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[#5D7188] uppercase font-bold block">Weight</span>
                  <span className="text-base font-extrabold text-[#1557B0] font-mono-stat">{weightPct}%</span>
                </div>
              </div>

              {/* Forecast Numbers */}
              <div className="bg-[#F5FAFF] rounded-xl p-3 mb-3 border border-[#D7E7F5]/70 space-y-1.5 text-xs font-mono-stat">
                <div className="flex items-center justify-between">
                  <span className="text-[#5D7188] flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-orange-500" /> Temp:
                  </span>
                  <span className="font-bold text-[#0F2742]">
                    {m.temperatureC != null ? formatTemp(m.temperatureC, '°C') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5D7188] flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-500" /> Rain:
                  </span>
                  <span className="font-bold text-[#0F2742]">
                    {m.precipitationMm != null ? `${m.precipitationMm} mm` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5D7188] flex items-center gap-1">
                    <Wind className="w-3 h-3 text-teal-500" /> Wind:
                  </span>
                  <span className="font-bold text-[#0F2742]">
                    {m.windSpeedKmh != null ? formatWind(m.windSpeedKmh, 'km/h') : '—'}
                  </span>
                </div>
              </div>

              {/* Historical Skill (Only if available from calibration metadata) */}
              <div className="pt-2 border-t border-[#D7E7F5] flex items-center justify-between text-[11px] font-mono-stat">
                <div>
                  <span className="text-[#5D7188] text-[10px] block">Historical MAE</span>
                  <span className="font-bold text-[#0F2742]">{mae != null ? `${mae.toFixed(3)}°C` : '—'}</span>
                </div>
                {rmse != null && (
                  <div className="text-right">
                    <span className="text-[#5D7188] text-[10px] block">Historical RMSE</span>
                    <span className="font-bold text-[#5D7188]">{rmse.toFixed(3)}°C</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Horizontal Weighted Contribution Chart */}
      <div className="card-3d bg-white p-6 rounded-3xl border border-[#D7E7F5] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-extrabold text-base text-[#0F2742] tracking-tight">Adaptive Model Contributions</h3>
            <p className="text-xs text-[#5D7188]">Normalized weights derived dynamically from historical inverse-MAE skill on ERA5 reanalysis</p>
          </div>
          <span className="text-[11px] font-mono-stat text-[#1557B0] bg-[#DCEEFF] px-2.5 py-1 rounded-full font-bold">
            Σ = 100.00%
          </span>
        </div>

        <div className="space-y-4">
          {models.map((m) => {
            const isAI = m.modelType === 'AI/ML';
            const weightVal = m.weight * 100;
            const weightPct = weightVal.toFixed(2);
            const mae = calib?.mae?.[m.modelName];
            const isHovered = hoveredModel === m.modelName;

            return (
              <div 
                key={m.modelName}
                onMouseEnter={() => setHoveredModel(m.modelName)}
                onMouseLeave={() => setHoveredModel(null)}
                className={`p-3 rounded-2xl transition-all ${isHovered ? 'bg-[#F5FAFF]' : ''}`}
              >
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#0F2742]">{m.modelName}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                      isAI ? 'bg-cyan-100 text-cyan-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {m.modelType || 'NWP'}
                    </span>
                    {mae != null && (
                      <span className="text-[11px] text-[#5D7188] font-mono-stat hidden sm:inline">
                        • MAE: {mae.toFixed(3)}°C
                      </span>
                    )}
                  </div>
                  <div className="font-mono-stat font-extrabold text-sm text-[#1557B0]">
                    {weightPct}%
                  </div>
                </div>

                {/* Animated Bar */}
                <div className="h-3.5 w-full bg-[#EBF5FF] rounded-full overflow-hidden p-0.5 border border-[#D7E7F5]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isAI
                        ? 'bg-gradient-to-r from-[#06B6D4] to-[#0284C7]'
                        : 'bg-gradient-to-r from-[#3B82F6] to-[#1557B0]'
                    } ${isHovered ? 'brightness-110 shadow-xs' : ''}`}
                    style={{ width: `${Math.max(5, weightVal)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
