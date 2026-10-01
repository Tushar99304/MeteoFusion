import React from 'react';
import type { ClimateDataPoint } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface TemperatureTrendChartProps {
  data: ClimateDataPoint[];
}

export const TemperatureTrendChart: React.FC<TemperatureTrendChartProps> = ({ data }) => {
  return (
    <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 lg:p-8 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-base text-[#0F2742]">Surface Temperature Anomaly Trend (°C)</h3>
          <p className="text-xs text-[#5D7188]">Deviation from the archive window’s multi-year baseline</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1557B0] border border-[#BFDBFE] text-xs font-mono-stat font-bold self-start sm:self-auto">
          Reanalysis Climate Archive
        </span>
      </div>

      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="anomalyGradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" />
            <YAxis tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" domain={['auto', 'auto']} unit="°C" />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#D7E7F5', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(21, 87, 176, 0.08)' }}
              formatter={(val: any) => [`${val}°C`, 'Anomaly vs Baseline']}
            />
            <Area type="monotone" dataKey="tempAnomaly" stroke="#1557B0" strokeWidth={2.5} fillOpacity={1} fill="url(#anomalyGradientBlue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-[#5D7188] text-center italic border-t border-[#D7E7F5] pt-2">
        Research/reproducibility historical reanalysis dataset. Not official IMD climate observations.
      </div>
    </div>
  );
};
