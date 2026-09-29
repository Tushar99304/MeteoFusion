import React from 'react';
import type { ClimateDataPoint } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface TemperatureTrendChartProps {
  data: ClimateDataPoint[];
}

export const TemperatureTrendChart: React.FC<TemperatureTrendChartProps> = ({ data }) => {
  return (
    <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-[#17352A]">Temperature Anomaly Trend (°C)</h3>
          <p className="text-xs text-[#6B7D74]">Deviation from the archive window’s own multi-year mean</p>
        </div>
        <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
          Reanalysis archive
        </span>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F4B942" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F4B942" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7D74' }} stroke="#DCEAE2" />
            <YAxis tick={{ fontSize: 11, fill: '#6B7D74' }} stroke="#DCEAE2" domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#DCEAE2', borderRadius: '8px', fontSize: '12px' }}
              formatter={(val: any) => [`${val}°C`, 'Anomaly vs window mean']}
            />
            <Area type="monotone" dataKey="tempAnomaly" stroke="#F4B942" strokeWidth={2.5} fillOpacity={1} fill="url(#anomalyGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-[#6B7D74] text-center italic">
        Research/reproducibility data (Open-Meteo ERA5-style archive). Not official IMD climate data.
      </div>
    </div>
  );
};
