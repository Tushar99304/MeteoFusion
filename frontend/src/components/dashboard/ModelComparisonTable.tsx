import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { Cpu, Wind, Layers } from 'lucide-react';
import { formatTemp, formatWind } from '../../utils/formatters';

export const ModelComparisonTable: React.FC = () => {
  const { currentWeather, calibration } = useWeatherStore();

  const blending = currentWeather?.blendingMetadata;
  const calib = blending?.calibrationMetadata || calibration;

  const models = blending?.models && blending.models.length > 0 ? blending.models : [
    { modelName: 'ECMWF IFS HRES', weight: 0.2828, modelType: 'NWP', temperatureC: 30.8, precipitationMm: 11.8, windSpeedKmh: 17.5 },
    { modelName: 'NCEP GFS', weight: 0.1292, modelType: 'NWP', temperatureC: 32.1, precipitationMm: 14.2, windSpeedKmh: 19.8 },
    { modelName: 'DWD ICON Global', weight: 0.2954, modelType: 'NWP', temperatureC: 30.6, precipitationMm: 12.0, windSpeedKmh: 17.9 },
    { modelName: 'ECMWF AIFS', weight: 0.2926, modelType: 'AI/ML', temperatureC: 31.0, precipitationMm: 12.2, windSpeedKmh: 18.1 },
  ];

  return (
    <div className="card-3d bg-white p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#DCEEFF] text-[#1557B0]">
              <Layers className="w-4 h-4 text-[#3B82F6]" />
            </span>
            <h3 className="text-lg font-extrabold text-[#0F2742] tracking-tight">Model Physics & Benchmark Matrix</h3>
          </div>
          <p className="text-xs text-[#5D7188] mt-0.5">Comprehensive multi-model comparative evaluation table</p>
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono-stat border-collapse">
          <thead>
            <tr className="border-b border-[#D7E7F5] text-[#5D7188] text-[11px] font-bold uppercase tracking-wider bg-[#F5FAFF]/60">
              <th className="py-3 px-4 rounded-l-xl">Model</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Forecast Temp</th>
              <th className="py-3 px-4">Rainfall</th>
              <th className="py-3 px-4">Wind Speed</th>
              <th className="py-3 px-4">Contribution Weight</th>
              <th className="py-3 px-4">Historical MAE</th>
              <th className="py-3 px-4 rounded-r-xl">Historical RMSE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D7E7F5]/70">
            {models.map((m) => {
              const isAI = m.modelType === 'AI/ML';
              const mae = calib?.mae?.[m.modelName];
              const rmse = calib?.rmse?.[m.modelName];
              const weightPct = (m.weight * 100).toFixed(2);

              return (
                <tr key={m.modelName} className="hover:bg-[#F5FAFF] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#0F2742]">
                    <div className="flex items-center gap-2 font-sans">
                      {isAI ? (
                        <Cpu className="w-4 h-4 text-[#06B6D4] shrink-0" />
                      ) : (
                        <Wind className="w-4 h-4 text-[#3B82F6] shrink-0" />
                      )}
                      <span>{m.modelName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      isAI
                        ? 'bg-cyan-100 text-cyan-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {m.modelType || 'NWP'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#0F2742]">
                    {m.temperatureC != null ? formatTemp(m.temperatureC, '°C') : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#0F2742]">
                    {m.precipitationMm != null ? `${m.precipitationMm} mm` : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#0F2742]">
                    {m.windSpeedKmh != null ? formatWind(m.windSpeedKmh, 'km/h') : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#1557B0]">
                    {weightPct}%
                  </td>
                  <td className="py-3.5 px-4 text-[#0F2742]">
                    {mae != null ? `${mae.toFixed(4)}°C` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-[#5D7188]">
                    {rmse != null ? `${rmse.toFixed(4)}°C` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
