import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { formatTemp, formatWind } from '../../utils/formatters';
import { Thermometer, CloudRain, Droplets, Wind, Cloudy, Gauge } from 'lucide-react';

/**
 * Detailed metric tiles. Only fields present in the backend current-conditions block are
 * rendered. UV index and visibility are NOT provided by the evidence, and the old
 * fabricated trend captions ("+1.5° vs yesterday", "peak at 2PM") were removed — the UI
 * never invents comparisons the evidence does not contain.
 */
export const WeatherSummary: React.FC = () => {
  const { currentWeather, preferences } = useWeatherStore();

  if (!currentWeather) return null;

  const metrics: { title: string; value: string; icon: React.ElementType }[] = [
    {
      title: 'Temperature',
      value:
        currentWeather.temperature != null
          ? formatTemp(currentWeather.temperature, preferences.tempUnit)
          : '—',
      icon: Thermometer,
    },
    {
      title: 'Apparent temp.',
      value:
        currentWeather.feelsLike != null
          ? formatTemp(currentWeather.feelsLike, preferences.tempUnit)
          : '—',
      icon: Thermometer,
    },
    {
      title: 'Observed rainfall',
      value: currentWeather.rainfall != null ? `${currentWeather.rainfall} mm` : '—',
      icon: CloudRain,
    },
    {
      title: 'Rain probability (today)',
      value: currentWeather.rainProbability != null ? `${currentWeather.rainProbability}%` : '—',
      icon: CloudRain,
    },
    {
      title: 'Relative humidity',
      value: currentWeather.humidity != null ? `${currentWeather.humidity}%` : '—',
      icon: Droplets,
    },
    {
      title: 'Wind speed',
      value:
        currentWeather.windSpeed != null
          ? formatWind(currentWeather.windSpeed, preferences.windUnit)
          : '—',
      icon: Wind,
    },
    {
      title: 'Cloud cover',
      value: currentWeather.cloudCover != null ? `${currentWeather.cloudCover}%` : '—',
      icon: Cloudy,
    },
    {
      title: 'Barometric pressure',
      value: currentWeather.pressure != null ? `${currentWeather.pressure} hPa` : '—',
      icon: Gauge,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#17352A] text-lg">Current observations</h3>
        <span className="text-xs text-[#6B7D74]">
          Open-Meteo current block · research/repro
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-[#DCEAE2] rounded-xl p-4 shadow-xs hover:border-[#6BAF92] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#6B7D74]">{m.title}</span>
                <div className="p-1.5 rounded-lg bg-[#E8F5EE] text-[#2E7D5B]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-[#17352A]">{m.value}</div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#6B7D74]">
        Values are the provider's reported current conditions. Open-Meteo is research/reproducibility
        data; there is no live IMD feed wired into this build.
      </p>
    </section>
  );
};
