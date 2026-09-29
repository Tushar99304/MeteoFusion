import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { formatTemp } from '../../utils/formatters';
import { ChevronDown, ChevronUp, CloudRain, Sun, CloudSun, CloudLightning, Info } from 'lucide-react';

/**
 * 7-day list. Shows only the days the backend actually returned (today + tomorrow in this
 * build) — no blank/padded rows are invented for days the provider did not cover.
 */
export const DailyForecastList: React.FC = () => {
  const { dailyForecast, preferences, usingSample } = useWeatherStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!dailyForecast || dailyForecast.length === 0) {
    return (
      <section className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-2">
        <h3 className="font-bold text-[#17352A] text-lg">Daily forecast</h3>
        <div className="flex items-start gap-2 text-xs text-[#6B7D74] bg-[#F7FBF8] border border-[#DCEAE2] rounded-xl p-3">
          <Info className="w-4 h-4 mt-0.5 text-[#2E7D5B] shrink-0" />
          <span>No daily forecast blocks are available for this query from current sources.</span>
        </div>
      </section>
    );
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const renderIcon = (condition?: string) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('lightning') || c.includes('thunder')) return <CloudLightning className="w-5 h-5 text-purple-600" />;
    if (c.includes('rain')) return <CloudRain className="w-5 h-5 text-blue-600" />;
    if (c.includes('sun') || c.includes('clear')) return <Sun className="w-5 h-5 text-amber-500" />;
    return <CloudSun className="w-5 h-5 text-emerald-600" />;
  };

  return (
    <section className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
        <h3 className="font-bold text-[#17352A] text-lg">
          Daily forecast{usingSample ? ' (sample)' : ''}
        </h3>
        <span className="text-xs text-[#6B7D74]">
          {usingSample ? 'Sample data (demo)' : 'Open-Meteo daily block · research/repro'}
        </span>
      </div>

      <div className="space-y-2">
        {dailyForecast.map((day, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={`${day.date}-${idx}`}
              className="border border-[#DCEAE2] rounded-xl overflow-hidden transition-all bg-white hover:border-[#6BAF92]"
            >
              <button
                onClick={() => toggleExpand(idx)}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F7FBF8] transition-colors"
              >
                <div className="flex items-center gap-3 w-36">
                  {renderIcon(day.condition)}
                  <div>
                    <span className="font-bold text-sm text-[#17352A] block">{day.dayName}</span>
                    <span className="text-[11px] text-[#6B7D74]">{day.date}</span>
                  </div>
                </div>

                <div className="hidden sm:block text-xs font-medium text-[#17352A] truncate max-w-xs">
                  {day.condition || '—'}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    💧 {day.rainProb != null ? `${day.rainProb}%` : '—'}
                  </div>
                  <div className="text-sm font-bold text-[#17352A] w-24 text-right">
                    {day.tempMin != null ? formatTemp(day.tempMin, preferences.tempUnit) : '—'} /{' '}
                    {day.tempMax != null ? formatTemp(day.tempMax, preferences.tempUnit) : '—'}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7D74]" /> : <ChevronDown className="w-4 h-4 text-[#6B7D74]" />}
                </div>
              </button>

              {isExpanded && (
                <div className="bg-[#E8F5EE]/50 p-4 border-t border-[#DCEAE2] text-xs text-[#17352A] space-y-2 animate-in fade-in duration-150">
                  {day.isForecast === false && (
                    <p className="font-semibold text-[#6B7D74]">
                      Observed/past model day — not a forecast.
                    </p>
                  )}
                  <p className="font-medium">{day.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-[#6B7D74] pt-1">
                    <div>
                      Expected rainfall:{' '}
                      <strong className="text-[#17352A]">
                        {day.expectedRainfallMm != null ? `${day.expectedRainfallMm} mm` : '—'}
                      </strong>
                    </div>
                    <div>
                      Wind speed max:{' '}
                      <strong className="text-[#17352A]">
                        {day.windSpeed != null ? `${day.windSpeed} km/h` : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!usingSample && (
        <p className="text-[11px] text-[#6B7D74]">
          Daily values are from the configured weather provider (Open-Meteo). Research/reproducibility
          data — not an official IMD district forecast.
        </p>
      )}
    </section>
  );
};
