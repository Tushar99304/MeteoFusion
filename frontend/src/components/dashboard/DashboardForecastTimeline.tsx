import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { CalendarDays, Thermometer, Droplets, Wind } from 'lucide-react';

export const DashboardForecastTimeline: React.FC = () => {
  const { hourlyForecast } = useWeatherStore();
  const [metricTab, setMetricTab] = useState<'temp' | 'rain' | 'wind'>('temp');

  const fallbackData = [
    { time: '12:00', temp: 31, rainfall: 0.2, rainProb: 40, windSpeed: 16 },
    { time: '14:00', temp: 32, rainfall: 1.4, rainProb: 65, windSpeed: 18 },
    { time: '16:00', temp: 30, rainfall: 3.2, rainProb: 80, windSpeed: 21 },
    { time: '18:00', temp: 29, rainfall: 2.1, rainProb: 70, windSpeed: 19 },
    { time: '20:00', temp: 28, rainfall: 0.8, rainProb: 50, windSpeed: 15 },
    { time: '22:00', temp: 27, rainfall: 0.1, rainProb: 30, windSpeed: 14 },
    { time: '00:00', temp: 26, rainfall: 0.0, rainProb: 20, windSpeed: 12 },
    { time: '02:00', temp: 26, rainfall: 0.0, rainProb: 15, windSpeed: 11 },
  ];

  const data = (hourlyForecast && hourlyForecast.length > 0)
    ? hourlyForecast.map((h) => ({
        time: h.time,
        temp: h.temp,
        rainfall: h.rainfall,
        rainProb: h.rainProb,
        windSpeed: h.windSpeed,
      }))
    : fallbackData;

  return (
    <div className="card-3d bg-white p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <CalendarDays className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-[#0F2742] tracking-tight">
                HOURLY FORECAST TRAJECTORY
              </h3>
              <p className="text-xs text-[#5D7188]">
                Next 24 hours high-resolution blended steps
              </p>
            </div>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F5FAFF] rounded-2xl border border-[#D7E7F5] self-start sm:self-auto">
          <button
            onClick={() => setMetricTab('temp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              metricTab === 'temp'
                ? 'bg-white text-[#1557B0] shadow-xs border border-[#BFDBFE]'
                : 'text-[#5D7188] hover:text-[#0F2742]'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5 text-orange-500" />
            <span>Temperature</span>
          </button>
          <button
            onClick={() => setMetricTab('rain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              metricTab === 'rain'
                ? 'bg-white text-[#1557B0] shadow-xs border border-[#BFDBFE]'
                : 'text-[#5D7188] hover:text-[#0F2742]'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Rainfall</span>
          </button>
          <button
            onClick={() => setMetricTab('wind')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              metricTab === 'wind'
                ? 'bg-white text-[#1557B0] shadow-xs border border-[#BFDBFE]'
                : 'text-[#5D7188] hover:text-[#0F2742]'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-teal-600" />
            <span>Wind Speed</span>
          </button>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {metricTab === 'temp' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBF5FF" vertical={false} />
              <XAxis dataKey="time" stroke="#5D7188" fontSize={11} tickLine={false} />
              <YAxis stroke="#5D7188" fontSize={11} tickLine={false} unit="°C" domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 bg-white/95 backdrop-blur-md rounded-xl border border-[#D7E7F5] shadow-lg text-xs font-mono-stat">
                        <div className="font-bold text-[#0F2742] mb-1">{label}</div>
                        <div className="text-[#1557B0] font-extrabold text-sm">
                          Temp: {payload[0].value}°C
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="temp" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
            </AreaChart>
          ) : metricTab === 'rain' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBF5FF" vertical={false} />
              <XAxis dataKey="time" stroke="#5D7188" fontSize={11} tickLine={false} />
              <YAxis stroke="#5D7188" fontSize={11} tickLine={false} unit="mm" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 bg-white/95 backdrop-blur-md rounded-xl border border-[#D7E7F5] shadow-lg text-xs font-mono-stat">
                        <div className="font-bold text-[#0F2742] mb-1">{label}</div>
                        <div className="text-[#0284C7] font-extrabold text-sm">
                          Rain: {payload[0].value} mm
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="rainfall" fill="#0284C7" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBF5FF" vertical={false} />
              <XAxis dataKey="time" stroke="#5D7188" fontSize={11} tickLine={false} />
              <YAxis stroke="#5D7188" fontSize={11} tickLine={false} unit="km/h" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 bg-white/95 backdrop-blur-md rounded-xl border border-[#D7E7F5] shadow-lg text-xs font-mono-stat">
                        <div className="font-bold text-[#0F2742] mb-1">{label}</div>
                        <div className="text-teal-700 font-extrabold text-sm">
                          Wind: {payload[0].value} km/h
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey="windSpeed" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3, fill: '#0D9488' }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
