import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { CloudSun, CloudRain, CloudLightning, Sun, Moon, Info } from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const HourlyForecastScroll: React.FC = () => {
  const { hourlyForecast, preferences, usingSample } = useWeatherStore();

  if (!hourlyForecast || hourlyForecast.length === 0) {
    return (
      <section className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-2">
        <h3 className="font-bold text-[#17352A] text-lg">Next 24 hours</h3>
        <div className="flex items-start gap-2 text-xs text-[#6B7D74] bg-[#F7FBF8] border border-[#DCEAE2] rounded-xl p-3">
          <Info className="w-4 h-4 mt-0.5 text-[#2E7D5B] shrink-0" />
          <span>
            Hourly forecast is not available for this query from the current sources, so no
            hourly strip is shown.
          </span>
        </div>
      </section>
    );
  }

  const chartData = hourlyForecast
    .filter((h) => h.temp != null)
    .map((h) => ({ time: h.time, temp: h.temp as number, rainProb: h.rainProb }));

  const renderIcon = (condition?: string) => {
    const c = (condition || '').toLowerCase();
    if (c.includes('lightning') || c.includes('thunder')) return <CloudLightning className="w-5 h-5 text-purple-600" />;
    if (c.includes('rain')) return <CloudRain className="w-5 h-5 text-blue-600" />;
    if (c.includes('night')) return <Moon className="w-5 h-5 text-indigo-500" />;
    if (c.includes('sun') || c.includes('clear')) return <Sun className="w-5 h-5 text-amber-500" />;
    return <CloudSun className="w-5 h-5 text-emerald-600" />;
  };

  return (
    <section className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#17352A] text-lg">Next 24 hours</h3>
        <span className="text-xs text-[#6B7D74]">
          {usingSample ? 'Sample data (demo)' : 'Open-Meteo forecast · research/repro'}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {hourlyForecast.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-24 bg-[#F7FBF8] border border-[#DCEAE2] rounded-xl p-3 text-center space-y-2 hover:border-[#2E7D5B] transition-colors"
          >
            <div className="text-xs font-semibold text-[#6B7D74]">{item.time}</div>
            <div className="flex justify-center my-1">{renderIcon(item.condition)}</div>
            <div className="text-base font-bold text-[#17352A]">
              {item.temp != null ? formatTemp(item.temp, preferences.tempUnit) : '—'}
            </div>
            <div className="text-[11px] font-semibold text-blue-700 bg-blue-50 py-0.5 rounded border border-blue-100">
              💧 {item.rainProb != null ? `${item.rainProb}%` : '—'}
            </div>
          </div>
        ))}
      </div>

      {chartData.length > 1 && (
        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D5B" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2E7D5B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#6B7D74' }} stroke="#DCEAE2" />
              <YAxis tick={{ fontSize: 11, fill: '#6B7D74' }} stroke="#DCEAE2" domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#DCEAE2', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: any) => [`${val}°C`, 'Temperature']}
              />
              <Area type="monotone" dataKey="temp" stroke="#2E7D5B" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
