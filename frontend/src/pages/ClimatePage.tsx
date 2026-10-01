import React, { useEffect, useState } from 'react';
import { RainfallTrendChart } from '../components/climate/RainfallTrendChart';
import { TemperatureTrendChart } from '../components/climate/TemperatureTrendChart';
import { getClimate } from '../services/climateService';
import type { ClimateResult } from '../types';
import { LineChart, Loader2, CloudOff, FlaskConical, Info, Thermometer, Droplets } from 'lucide-react';
import { useWeatherStore } from '../store/useWeatherStore';

export const ClimatePage: React.FC = () => {
  const { currentLocation, preferences } = useWeatherStore();
  const [selectedMetric, setSelectedMetric] = useState<'rainfall' | 'temp'>('rainfall');
  const [data, setData] = useState<ClimateResult | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getClimate(currentLocation.name, preferences.demoMode)
      .then(({ result, isSample: sample }) => {
        if (cancelled) return;
        setData(result);
        setIsSample(sample);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentLocation, preferences.demoMode]);

  const points = data?.points ?? [];
  const hasTemp = points.some((p) => p.tempAvg != null);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <LineChart className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <span className="text-[10px] font-bold text-[#1557B0] uppercase tracking-wider bg-[#EBF5FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
              Historical Reanalysis Archive
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2742] tracking-tight">
            Climate Dynamics & Multi-Year Trends
          </h1>
          <p className="text-xs sm:text-sm text-[#5D7188] mt-1 font-medium">
            Aggregated archive data for {data?.location || currentLocation.name}. Research & reproducibility benchmark.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold border ${
              isSample
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-[#1557B0]'
            } flex items-center gap-1.5 shadow-2xs`}
          >
            {isSample ? <FlaskConical className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            <span>{isSample ? 'SAMPLE DEMO DATA' : 'Research / Reproducibility Archive'}</span>
          </span>
        </div>
      </div>

      {/* Attribution Disclosure */}
      <div className="p-4 rounded-2xl bg-[#EBF5FF] border border-[#BFDBFE] text-xs text-[#1557B0] leading-relaxed flex items-start gap-3">
        <Info className="w-5 h-5 text-[#3B82F6] shrink-0 mt-0.5" />
        <p>
          <strong>Scientific Attribution:</strong> Multi-year climate trends are aggregated from Open-Meteo's historical reanalysis archive for <strong>research and benchmark reproducibility</strong>. They are <strong>not official India Meteorological Department (IMD) climate normals</strong> and are never claimed as IMD baseline data. {data?.period ? `Period analyzed: ${data.period}.` : ''}
        </p>
      </div>

      {loading ? (
        <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-16 text-center text-xs text-[#5D7188] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
          <span className="font-bold text-[#0F2742]">Synthesizing Historical Climate Archive…</span>
        </div>
      ) : !data?.available ? (
        <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-12 text-center space-y-3">
          <CloudOff className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0F2742]">Climate Archive Unavailable for Selected Coordinates</h3>
          <p className="text-xs text-[#5D7188] max-w-md mx-auto leading-relaxed">
            {data?.note ||
              'The historical climate archive could not be verified for this station. Data is withheld rather than simulated.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab Selector */}
          <div className="flex items-center gap-2 border-b border-[#D7E7F5] pb-3">
            <button
              onClick={() => setSelectedMetric('rainfall')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                selectedMetric === 'rainfall'
                  ? 'bg-[#1557B0] text-white shadow-xs'
                  : 'bg-white text-[#0F2742] border border-[#D7E7F5] hover:bg-[#F5FAFF]'
              }`}
            >
              <Droplets className="w-4 h-4 text-cyan-300" />
              <span>Rainfall Trajectory</span>
            </button>
            <button
              onClick={() => setSelectedMetric('temp')}
              disabled={!hasTemp}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-2xs ${
                selectedMetric === 'temp'
                  ? 'bg-[#1557B0] text-white shadow-xs'
                  : 'bg-white text-[#0F2742] border border-[#D7E7F5] hover:bg-[#F5FAFF]'
              }`}
            >
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span>Thermal Anomalies</span>
            </button>
          </div>

          {selectedMetric === 'rainfall' ? (
            <RainfallTrendChart data={points} />
          ) : (
            <TemperatureTrendChart data={points} />
          )}
        </div>
      )}
    </div>
  );
};
