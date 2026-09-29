import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { SourceBadge } from '../common/SourceBadge';
import { formatTemp, formatWind } from '../../utils/formatters';
import { CloudRain, Wind, Droplets, Gauge, Clock, AlertTriangle, CloudOff } from 'lucide-react';

export const CurrentWeatherCard: React.FC = () => {
  const { currentWeather, preferences, isLoading, error, usingSample, usingCached, expiredAlerts, alerts } =
    useWeatherStore();

  if (isLoading && !currentWeather) {
    return (
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 shadow-xs animate-pulse space-y-4">
        <div className="h-6 w-48 bg-[#E8F5EE] rounded" />
        <div className="h-12 w-24 bg-[#E8F5EE] rounded" />
      </div>
    );
  }

  if (!currentWeather) {
    return (
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 shadow-xs space-y-3 text-center">
        <CloudOff className="w-8 h-8 text-[#6BAF92] mx-auto" />
        <p className="text-sm font-bold text-[#17352A]">No verified current weather</p>
        <p className="text-xs text-[#6B7D74]">
          {error ||
            'The WeatherGPT backend could not provide grounded current conditions for this location yet.'}
        </p>
      </div>
    );
  }

  const warningCount = alerts.length;

  return (
    <div className="bg-gradient-to-br from-white via-[#F7FBF8] to-[#E8F5EE]/40 border border-[#DCEAE2] rounded-2xl p-6 shadow-xs relative overflow-hidden">
      <div className="absolute right-0 top-0 w-64 h-64 bg-[#6BAF92]/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />

      {(usingSample || usingCached) && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          {usingSample
            ? 'SAMPLE DEMO DATA — not a live or official source.'
            : `Showing cached evidence from ${currentWeather.observedAt} — not live.`}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-[#17352A]">{currentWeather.location}</h2>
            <SourceBadge source={currentWeather.source} authority={currentWeather.authority} size="sm" />
          </div>
          <p className="text-xs text-[#6B7D74] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />{' '}
            {usingCached ? 'Cached observation' : 'Observed'}: {currentWeather.observedAt}
            {currentWeather.providerModel ? ` · model ${currentWeather.providerModel}` : ''}
          </p>
        </div>

        {warningCount > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>{warningCount} active official NDMA/SACHET alert{warningCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#2E7D5B]/10 flex items-center justify-center text-[#2E7D5B]">
            <CloudRain className="w-10 h-10" />
          </div>
          <div>
            <div className="text-4xl sm:text-5xl font-extrabold text-[#17352A] tracking-tight">
              {currentWeather.temperature != null
                ? formatTemp(currentWeather.temperature, preferences.tempUnit)
                : '—'}
            </div>
            <div className="text-xs text-[#6B7D74] font-medium mt-0.5">
              {currentWeather.feelsLike != null
                ? `Feels like ${formatTemp(currentWeather.feelsLike, preferences.tempUnit)}`
                : 'Apparent temperature unavailable'}{' '}
              • {currentWeather.conditionText || 'Condition unavailable'}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric icon={<Droplets className="w-3.5 h-3.5" />} label="Humidity"
            value={currentWeather.humidity != null ? `${currentWeather.humidity}%` : '—'} />
          <Metric icon={<Wind className="w-3.5 h-3.5" />} label="Wind"
            value={currentWeather.windSpeed != null ? formatWind(currentWeather.windSpeed, preferences.windUnit) : '—'} />
          <Metric icon={<CloudRain className="w-3.5 h-3.5" />} label="Rainfall"
            value={currentWeather.rainfall != null ? `${currentWeather.rainfall} mm` : '—'} />
          <Metric icon={<Gauge className="w-3.5 h-3.5" />} label="Pressure"
            value={currentWeather.pressure != null ? `${currentWeather.pressure} hPa` : '—'} />
        </div>
      </div>

      {expiredAlerts && expiredAlerts.length > 0 && (
        <p className="mt-4 text-[11px] text-[#6B7D74]">
          {expiredAlerts.length} expired alert(s) on record — shown for transparency only, never as current guidance.
        </p>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-white/80 backdrop-blur-xs border border-[#DCEAE2] p-3 rounded-xl">
    <div className="text-xs text-[#6B7D74] flex items-center gap-1 mb-1">
      {icon} {label}
    </div>
    <div className="text-base font-bold text-[#17352A]">{value}</div>
  </div>
);
