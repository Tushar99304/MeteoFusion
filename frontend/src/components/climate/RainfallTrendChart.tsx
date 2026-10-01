import React from 'react';
import type { ClimateDataPoint } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface RainfallTrendChartProps {
  data: ClimateDataPoint[];
}

export const RainfallTrendChart: React.FC<RainfallTrendChartProps> = ({ data }) => {
  return (
    <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 lg:p-8 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-base text-[#0F2742]">Annual Rainfall vs Window Baseline Mean (mm)</h3>
          <p className="text-xs text-[#5D7188]">Archive multi-year precipitation depth comparison (Research archive, not official IMD normals)</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1557B0] border border-[#BFDBFE] text-xs font-mono-stat font-bold self-start sm:self-auto">
          Open-Meteo ERA5-Style Archive
        </span>
      </div>

      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" />
            <YAxis tick={{ fontSize: 11, fill: '#5D7188' }} stroke="#D7E7F5" />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#D7E7F5', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(21, 87, 176, 0.08)' }}
              formatter={(val: any) => [`${val} mm`, 'Rainfall']}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="rainfallActual" name="Annual Recorded Rainfall" fill="#1557B0" radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Bar dataKey="rainfallNormal" name="Window Mean Baseline" fill="#93C5FD" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-[#5D7188] text-center italic border-t border-[#D7E7F5] pt-2">
        Research/reproducibility reanalysis archive. Not official India Meteorological Department (IMD) observation normal.
      </div>
    </div>
  );
};
