import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { CloudSun, CloudRain, CloudLightning, Sun, Moon, Info, Clock } from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const HourlyForecastScroll: React.FC = () => {
  const { hourlyForecast, preferences, usingSample } = useWeatherStore();

  if (!hourlyForecast || hourlyForecast.length === 0) {
    return (
      <section className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 shadow-xs space-y-2">
        <h3 className="font-extrabold text-[#0F2742] text-lg">Next 24 Hours Trajectory</h3>
        <div className="flex items-start gap-2 text-xs text-[#5D7188] bg-[#F5FAFF] border border-[#D7E7F5] rounded-2xl p-4">
          <Info className="w-4 h-4 mt-0.5 text-[#3B82F6] shrink-0" />
          <span>
            Hourly forecast points are not provided for this query by current upstream providers.
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
    if (c.includes('lightning') || c.includes('thunder')) return <CloudLightning className="w-5 h-5 text-indigo-600" />;
    if (c.includes('rain')) return <CloudRain className="w-5 h-5 text-[#3B82F6]" />;
    if (c.includes('night')) return <Moon className="w-5 h-5 text-indigo-500" />;
    if (c.includes('sun') || c.includes('clear')) return <Sun className="w-5 h-5 text-amber-500" />;
    return <CloudSun className="w-5 h-5 text-[#3B82F6]" />;
  };

  return (
    <section className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 lg:p-8 shadow-xs space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#3B82F6]" />
          <h3 className="font-extrabold text-[#0F2742] text-lg">Next 24 Hours Sequence</h3>
        </div>
        <span className="text-xs font-mono-stat text-[#5D7188] bg-[#F5FAFF] px-2.5 py-1 rounded-full border border-[#D7E7F5]">
          {usingSample ? 'Sample Demo Data' : 'Open-Meteo High-Res Hourly'}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
        {hourlyForecast.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-24 bg-[#F5FAFF] border border-[#D7E7F5] rounded-2xl p-3 text-center space-y-2 hover:border-[#3B82F6] hover:bg-white transition-all shadow-2xs"
          >
            <div className="text-xs font-mono-stat font-semibold text-[#5D7188]">{item.time}</div>
            <div className="flex justify-center my-1">{renderIcon(item.condition)}</div>
            <div className="text-base font-extrabold text-[#0F2742] font-mono-stat">
              {item.temp != null ? formatTemp(item.temp, preferences.tempUnit) : '—'}
            </div>
            <div className="text-[11px] font-semibold text-[#1557B0] bg-[#DCEEFF] py-0.5 rounded-lg border border-[#BFDBFE]">
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
                <linearGradient id="tempGradientHourly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" />
              <YAxis tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#D7E7F5', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(21, 87, 176, 0.08)' }}
                formatter={(val: any) => [`${val}°C`, 'Temperature']}
              />
              <Area type="monotone" dataKey="temp" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradientHourly)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
