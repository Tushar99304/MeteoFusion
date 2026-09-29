import React, { useEffect, useState } from 'react';
import { RainfallTrendChart } from '../components/climate/RainfallTrendChart';
import { TemperatureTrendChart } from '../components/climate/TemperatureTrendChart';
import { getClimate } from '../services/climateService';
import type { ClimateResult } from '../types';
import { LineChart, BarChart3, Loader2, CloudOff, FlaskConical, Info } from 'lucide-react';
import { useWeatherStore } from '../store/useWeatherStore';

export const ClimatePage: React.FC = () => {
  const { currentLocation, preferences } = useWeatherStore();
  const [selectedMetric, setSelectedMetric] = useState<'rainfall' | 'temp'>('rainfall');
  const [data, setData] = useState<ClimateResult | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getClimate(currentLocation.name, preferences.demoMode)
      .then(({ result, isSample: sample }) => {
        if (cancelled) return;
        setData(result);
        setIsSample(sample);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
            <LineChart className="w-6 h-6 text-[#2E7D5B]" />
            Long-term Climate Trends — {data?.location || currentLocation.name}
          </h1>
          <p className="text-xs text-[#6B7D74]">
            Historical rainfall and temperature trends aggregated from the Open-Meteo reanalysis
            archive
          </p>
        </div>

        <span
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto border ${
            isSample
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          } flex items-center gap-1.5`}
        >
          {isSample ? <FlaskConical className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          {isSample ? 'SAMPLE DEMO DATA' : 'Research / repro archive (not IMD)'}
        </span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 leading-relaxed">
        <strong>Source honesty:</strong> trends are aggregated from Open-Meteo’s ERA5-style
        reanalysis archive for <strong>research and reproducibility</strong>. They are{' '}
        <strong>not official India Meteorological Department (IMD) climate normals</strong> and no
        IMD claim is made. The “norm” line is this archive window’s own mean, not an official
        baseline. {data?.period ? `Shown period: ${data.period}.` : ''}
      </div>

      {loading ? (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-12 text-center text-sm text-[#6B7D74] flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#2E7D5B]" /> Loading historical archive…
        </div>
      ) : !data?.available ? (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-10 text-center space-y-2">
          <CloudOff className="w-9 h-9 text-amber-600 mx-auto" />
          <p className="font-bold text-sm text-[#17352A]">Climate archive unavailable</p>
          <p className="text-xs text-[#6B7D74] max-w-md mx-auto">
            {data?.note ||
              'The research climate archive could not be consulted for this location. No trend is shown rather than fabricated.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-[#DCEAE2] pb-3">
            <button
              onClick={() => setSelectedMetric('rainfall')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedMetric === 'rainfall'
                  ? 'bg-[#2E7D5B] text-white shadow-xs'
                  : 'bg-white text-[#17352A] border border-[#DCEAE2] hover:bg-[#E8F5EE]'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Rainfall Dynamics
            </button>
            <button
              onClick={() => setSelectedMetric('temp')}
              disabled={!hasTemp}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                selectedMetric === 'temp'
                  ? 'bg-[#2E7D5B] text-white shadow-xs'
                  : 'bg-white text-[#17352A] border border-[#DCEAE2] hover:bg-[#E8F5EE]'
              }`}
            >
              <LineChart className="w-4 h-4" /> Temperature Warming
            </button>
          </div>

          {selectedMetric === 'rainfall' ? (
            <RainfallTrendChart data={points} />
          ) : (
            <TemperatureTrendChart data={points} />
          )}

          <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-[#DCEAE2] pb-3">
              <h3 className="font-bold text-base text-[#17352A]">
                Heavy rain days ({data.period})
              </h3>
              <p className="text-xs text-[#6B7D74]">
                Days with ≥115 mm daily precipitation — the same engineering heuristic the
                advisory engine uses; not an IMD criterion.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {points.map((pt) => (
                <div
                  key={pt.year}
                  className="bg-[#F7FBF8] border border-[#DCEAE2] p-3 rounded-xl text-center space-y-1"
                >
                  <span className="text-xs font-bold text-[#6B7D74]">{pt.year}</span>
                  <div className="text-xl font-extrabold text-[#2E7D5B]">{pt.extremeEventsCount}</div>
                  <span className="text-[10px] text-[#6B7D74]">Heavy-rain days</span>
                </div>
              ))}
            </div>
          </div>

          {data.disclaimer && (
            <p className="text-[11px] text-[#6B7D74] leading-relaxed">{data.disclaimer}</p>
          )}
        </>
      )}
    </div>
  );
};
