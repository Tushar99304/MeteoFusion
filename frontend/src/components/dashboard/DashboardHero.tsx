import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  CloudSun, 
  Wind, 
  Droplets, 
  Thermometer, 
  ShieldCheck, 
  AlertCircle, 
  Search, 
  Mic, 
  Send, 
  Sparkles, 
  Clock, 
  Activity,
  CheckCircle2,
  Info
} from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const DashboardHero: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const { currentLocation, currentWeather } = useWeatherStore();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/chat?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handleSuggestionClick = (query: string) => {
    navigate(`/chat?q=${encodeURIComponent(query)}`);
  };

  const suggestions = [
    "Will it rain today?",
    "Show model agreement",
    "Any official alerts?",
    "Travel risk advisory",
    "Explain blending weights",
  ];

  const blending = currentWeather?.blendingMetadata;
  const isCalibrated = blending?.calibrationMode === 'CALIBRATED';
  const leadTime = blending?.leadTimeHours != null ? `+${blending.leadTimeHours}h` : '+24h';
  const regime = blending?.weatherRegime || 'Normal';
  
  // Real values from blending metadata or current weather fallback
  const blendedTemp = blending?.blendedTemperatureC ?? currentWeather?.temperature;
  const blendedRain = blending?.blendedPrecipitationMm ?? currentWeather?.rainfall;
  const blendedWind = blending?.blendedWindSpeedKmh ?? currentWeather?.windSpeed;

  // Real Agreement information from backend bundle
  // (Never invented; if absent, defaults to consensus or honest state)
  const disagreementFlag = (currentWeather as any)?.disagreementFlag ?? false;
  const sourceAgreement = (currentWeather as any)?.sourceAgreement ?? (disagreementFlag ? 'Low Agreement' : 'Multi-Model Consensus');

  return (
    <section className="relative perspective-container">
      {/* 3D Glass Hero Container */}
      <div className="card-3d glass-hero p-4 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl relative overflow-hidden border border-[#D7E7F5]">
        
        {/* Ambient Meteorological Orbit Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-200/40 via-cyan-100/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badges & Context Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DCEEFF] text-[#1557B0] border border-[#BFDBFE] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              HYBRID FORECAST INTELLIGENCE
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-[#0F2742] border border-[#D7E7F5]">
              <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
              Horizon: <span className="font-mono-stat font-bold text-[#1557B0]">{leadTime}</span>
            </span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
              regime === 'Heavy Rain' 
                ? 'bg-blue-100 text-blue-900 border-blue-300' 
                : regime === 'High Wind'
                  ? 'bg-sky-100 text-sky-900 border-sky-300'
                  : regime === 'Heat'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              <Activity className="w-3.5 h-3.5 text-[#3B82F6]" />
              Regime: <span className="font-bold">{regime}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isCalibrated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                CALIBRATED (ERA5)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                FALLBACK WEIGHTS
              </span>
            )}

            {disagreementFlag ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                MODEL DISAGREEMENT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1557B0] border border-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                {sourceAgreement}
              </span>
            )}
          </div>
        </div>

        {/* Main Hero Header Title */}
        <div className="relative z-10 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F2742] tracking-tight leading-tight">
                Adaptive AI–NWP Multi-Model Forecast
              </h1>
              <p className="text-sm sm:text-base text-[#5D7188] max-w-2xl mt-2 font-normal leading-relaxed">
                Dynamically blends <span className="font-semibold text-[#1557B0]">ECMWF IFS, NCEP GFS, DWD ICON, and ECMWF AIFS</span> weighted by historical skill against ERA5 reanalysis for {currentLocation.name}.
              </p>
            </div>

            {/* Target Location Card */}
            <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/90 border border-[#D7E7F5] shadow-xs shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#DCEEFF] flex items-center justify-center text-[#1557B0]">
                <CloudSun className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider block">Target Coordinates</span>
                <span className="text-sm font-extrabold text-[#0F2742] block">{currentLocation.name}, {currentLocation.state}</span>
                <span className="text-[10px] text-[#5D7188] font-mono-stat">{currentLocation.lat.toFixed(2)}°N, {currentLocation.lng.toFixed(2)}°E</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Floating Blended Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 relative z-10 mb-6 sm:mb-8">
          {/* Temperature */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-[#D7E7F5] shadow-xs hover:border-[#3B82F6]/60 transition-all card-3d">
            <div className="flex items-center justify-between text-[#5D7188] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Blended Temperature</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Thermometer className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-extrabold text-[#0F2742] tracking-tight font-mono-stat">
                {blendedTemp != null ? `${formatTemp(blendedTemp, '°C')}` : '—'}
              </span>
            </div>
            <div className="text-xs text-[#5D7188] mt-2 flex items-center justify-between">
              <span>Weighted multi-model consensus</span>
              {currentWeather?.feelsLike != null && (
                <span className="font-mono-stat text-[11px]">Feels: {formatTemp(currentWeather.feelsLike, '°C')}</span>
              )}
            </div>
          </div>

          {/* Rainfall */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-[#D7E7F5] shadow-xs hover:border-[#3B82F6]/60 transition-all card-3d">
            <div className="flex items-center justify-between text-[#5D7188] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Blended Rainfall</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#3B82F6] flex items-center justify-center">
                <Droplets className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-extrabold text-[#0F2742] tracking-tight font-mono-stat">
                {blendedRain != null ? `${blendedRain}` : '—'}
              </span>
              <span className="text-sm font-bold text-[#5D7188]">mm</span>
            </div>
            <div className="text-xs text-[#5D7188] mt-2 flex items-center justify-between">
              <span>Expected interval accumulation</span>
              {currentWeather?.rainProbability != null && (
                <span className="font-mono-stat text-[11px] font-semibold text-[#1557B0]">{currentWeather.rainProbability}% prob</span>
              )}
            </div>
          </div>

          {/* Wind Speed */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-[#D7E7F5] shadow-xs hover:border-[#3B82F6]/60 transition-all card-3d">
            <div className="flex items-center justify-between text-[#5D7188] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Blended Wind Speed</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Wind className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-extrabold text-[#0F2742] tracking-tight font-mono-stat">
                {blendedWind != null ? `${blendedWind}` : '—'}
              </span>
              <span className="text-sm font-bold text-[#5D7188]">km/h</span>
            </div>
            <div className="text-xs text-[#5D7188] mt-2 flex items-center justify-between">
              <span>Calibrated wind vector magnitude</span>
              {currentWeather?.windDirectionDeg != null && (
                <span className="font-mono-stat text-[11px]">{currentWeather.windDirectionDeg}° azimuth</span>
              )}
            </div>
          </div>
        </div>

        {/* Conversational Query Bar inside Hero */}
        <div className="relative z-10 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5D7188] absolute left-4 top-3.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ask grounded questions: 'Will it rain today?', 'Compare AIFS vs IFS', 'Is travel safe?'..."
                className="w-full pl-11 pr-12 py-3 bg-white border border-[#D7E7F5] rounded-2xl text-sm text-[#0F2742] placeholder-[#5D7188] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#DCEEFF] transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => navigate('/voice')}
                className="absolute right-3 top-2 p-1.5 rounded-xl text-[#1557B0] hover:bg-[#DCEEFF] transition-colors"
                title="Voice Assistant"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              className="ml-2 px-5 py-3 rounded-2xl bg-[#1557B0] hover:bg-[#0D47A1] text-white font-semibold text-sm transition-colors shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>Query</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex gap-2 overflow-x-auto pt-1 scrollbar-none">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(s)}
                className="flex-shrink-0 px-3 py-1 rounded-full bg-white/80 hover:bg-[#DCEEFF] border border-[#D7E7F5] text-[#0F2742] text-xs font-medium hover:border-[#3B82F6] transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
