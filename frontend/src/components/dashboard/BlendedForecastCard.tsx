import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Layers
} from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const BlendedForecastCard: React.FC = () => {
  const { currentWeather, currentLocation } = useWeatherStore();

  const blending = currentWeather?.blendingMetadata;
  const isCalibrated = blending?.calibrationMode === 'CALIBRATED';
  const regime = blending?.weatherRegime || 'Normal';
  const leadTime = blending?.leadTimeHours != null ? `+${blending.leadTimeHours}h` : '+24h';
  const region = blending?.region || `${currentLocation.lat.toFixed(2)}°N, ${currentLocation.lng.toFixed(2)}°E`;
  const targetTime = blending?.targetTime || currentWeather?.retrievedAtUtc || 'Current operational window';

  const temp = blending?.blendedTemperatureC ?? currentWeather?.temperature;
  const precip = blending?.blendedPrecipitationMm ?? currentWeather?.rainfall;
  const wind = blending?.blendedWindSpeedKmh ?? currentWeather?.windSpeed;

  return (
    <div className="card-3d-interactive glass-hero p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-lg relative overflow-hidden">
      {/* Ambient Radial Highlights */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div>
          <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider block">Operational Output</span>
          <h3 className="text-2xl font-extrabold text-[#0F2742] tracking-tight flex items-center gap-2">
            <span>HYBRID FORECAST SYNTHESIS</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isCalibrated
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {isCalibrated ? 'CALIBRATED' : 'FALLBACK'}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-stat text-[#5D7188]">
          <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Horizon: <strong className="text-[#1557B0]">{leadTime}</strong></span>
        </div>
      </div>

      {/* Core Blended Metric Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative z-10">
        <div className="p-4 rounded-2xl bg-white/90 border border-[#D7E7F5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#5D7188] mb-1">
            <span className="font-semibold uppercase tracking-wider">Temperature</span>
            <Thermometer className="w-4 h-4 text-orange-500" />
          </div>
          <div className="font-mono-stat text-3xl font-extrabold text-[#0F2742]">
            {temp != null ? `${formatTemp(temp, '°C')}` : '—'}
          </div>
          <span className="text-[10px] text-[#5D7188] mt-1 block">Weighted blend across 4 models</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/90 border border-[#D7E7F5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#5D7188] mb-1">
            <span className="font-semibold uppercase tracking-wider">Precipitation</span>
            <Droplets className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div className="font-mono-stat text-3xl font-extrabold text-[#0F2742]">
            {precip != null ? `${precip} mm` : '—'}
          </div>
          <span className="text-[10px] text-[#5D7188] mt-1 block">Forecast accumulation</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/90 border border-[#D7E7F5] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#5D7188] mb-1">
            <span className="font-semibold uppercase tracking-wider">Wind Speed</span>
            <Wind className="w-4 h-4 text-teal-600" />
          </div>
          <div className="font-mono-stat text-3xl font-extrabold text-[#0F2742]">
            {wind != null ? `${wind} km/h` : '—'}
          </div>
          <span className="text-[10px] text-[#5D7188] mt-1 block">Wind vector magnitude</span>
        </div>
      </div>

      {/* Target & Operational Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-stat mb-6 relative z-10">
        <div className="p-3 rounded-xl bg-[#F5FAFF]/80 border border-[#D7E7F5]">
          <span className="text-[10px] text-[#5D7188] uppercase block">Geographic Grid</span>
          <span className="font-bold text-[#0F2742] truncate block">{region}</span>
        </div>
        <div className="p-3 rounded-xl bg-[#F5FAFF]/80 border border-[#D7E7F5]">
          <span className="text-[10px] text-[#5D7188] uppercase block">Weather Regime</span>
          <span className="font-bold text-[#1557B0] block">{regime}</span>
        </div>
        <div className="p-3 rounded-xl bg-[#F5FAFF]/80 border border-[#D7E7F5]">
          <span className="text-[10px] text-[#5D7188] uppercase block">Forecast Horizon</span>
          <span className="font-bold text-[#0F2742] block">{leadTime}</span>
        </div>
        <div className="p-3 rounded-xl bg-[#F5FAFF]/80 border border-[#D7E7F5]">
          <span className="text-[10px] text-[#5D7188] uppercase block">Target Timestamp</span>
          <span className="font-bold text-[#0F2742] truncate block">{targetTime}</span>
        </div>
      </div>

      {/* Scientific Roadmap / Calibration Layers */}
      <div className="p-4 rounded-2xl bg-white/70 border border-[#D7E7F5] relative z-10">
        <div className="text-[11px] font-bold text-[#5D7188] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Synthesis Processing Stack</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-900 block">WEIGHTED BLEND</span>
              <span className="text-[10px] text-emerald-700">Active Operational Core</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
            <Circle className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-600 block">BIAS CORRECTION</span>
              <span className="text-[10px] text-slate-400">Future capability</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
            <Circle className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-600 block">AI RESIDUAL LAYER</span>
              <span className="text-[10px] text-slate-400">Future capability</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
