import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { formatTemp } from '../../utils/formatters';
import { ChevronDown, ChevronUp, CloudRain, Sun, CloudSun, CloudLightning, Info, Calendar } from 'lucide-react';

export const DailyForecastList: React.FC = () => {
  const { dailyForecast, preferences, usingSample } = useWeatherStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!dailyForecast || dailyForecast.length === 0) {
    return (
      <section className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 shadow-xs space-y-2">
        <h3 className="font-extrabold text-[#0F2742] text-lg">Daily Multi-Day Horizon</h3>
        <div className="flex items-start gap-2 text-xs text-[#5D7188] bg-[#F5FAFF] border border-[#D7E7F5] rounded-2xl p-4">
          <Info className="w-4 h-4 mt-0.5 text-[#3B82F6] shrink-0" />
          <span>No daily forecast blocks are available for this query from current upstream sources.</span>
        </div>
      </section>
    );
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const renderIcon = (condition?: string) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('lightning') || c.includes('thunder')) return <CloudLightning className="w-5 h-5 text-indigo-600" />;
    if (c.includes('rain')) return <CloudRain className="w-5 h-5 text-[#3B82F6]" />;
    if (c.includes('sun') || c.includes('clear')) return <Sun className="w-5 h-5 text-amber-500" />;
    return <CloudSun className="w-5 h-5 text-[#3B82F6]" />;
  };

  return (
    <section className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 lg:p-8 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#3B82F6]" />
          <h3 className="font-extrabold text-[#0F2742] text-lg">
            Daily Forecast Horizon{usingSample ? ' (Sample)' : ''}
          </h3>
        </div>
        <span className="text-xs font-mono-stat text-[#5D7188] bg-[#F5FAFF] px-2.5 py-1 rounded-full border border-[#D7E7F5]">
          {usingSample ? 'Sample data (demo)' : 'Open-Meteo Multi-Day Block'}
        </span>
      </div>

      <div className="space-y-2.5">
        {dailyForecast.map((day, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={`${day.date}-${idx}`}
              className="border border-[#D7E7F5] rounded-2xl overflow-hidden transition-all bg-white hover:border-[#3B82F6]"
            >
              <button
                onClick={() => toggleExpand(idx)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F5FAFF] transition-colors"
              >
                <div className="flex items-center gap-3 w-40">
                  {renderIcon(day.condition)}
                  <div>
                    <span className="font-extrabold text-sm text-[#0F2742] block">{day.dayName}</span>
                    <span className="text-[11px] text-[#5D7188] font-mono-stat">{day.date}</span>
                  </div>
                </div>

                <div className="hidden sm:block text-xs font-semibold text-[#5D7188] truncate max-w-xs">
                  {day.condition || '—'}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-xs font-semibold text-[#1557B0] bg-[#DCEEFF] px-2.5 py-1 rounded-lg border border-[#BFDBFE]">
                    💧 {day.rainProb != null ? `${day.rainProb}%` : '—'}
                  </div>
                  <div className="text-sm font-bold text-[#0F2742] w-28 text-right font-mono-stat">
                    {day.tempMin != null ? formatTemp(day.tempMin, preferences.tempUnit) : '—'} /{' '}
                    {day.tempMax != null ? formatTemp(day.tempMax, preferences.tempUnit) : '—'}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#5D7188]" /> : <ChevronDown className="w-4 h-4 text-[#5D7188]" />}
                </div>
              </button>

              {isExpanded && (
                <div className="bg-[#F5FAFF] p-4 border-t border-[#D7E7F5] text-xs text-[#0F2742] space-y-2 animate-in fade-in duration-150">
                  {day.isForecast === false && (
                    <p className="font-semibold text-[#5D7188]">
                      Observed / past model interval — not a forecast.
                    </p>
                  )}
                  <p className="font-medium text-[#0F2742]">{day.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-[#5D7188] font-mono-stat pt-2">
                    <div>
                      Expected rainfall:{' '}
                      <strong className="text-[#0F2742]">
                        {day.expectedRainfallMm != null ? `${day.expectedRainfallMm} mm` : '—'}
                      </strong>
                    </div>
                    <div>
                      Max precipitation prob:{' '}
                      <strong className="text-[#0F2742]">
                        {day.rainProb != null ? `${day.rainProb}%` : '—'}
                      </strong>
                    </div>
                    <div>
                      Max wind speed:{' '}
                      <strong className="text-[#0F2742]">
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
    </section>
  );
};
