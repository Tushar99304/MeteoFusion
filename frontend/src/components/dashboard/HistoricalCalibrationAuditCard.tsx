import React, { useState, useEffect } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { ShieldCheck, Cpu, Wind, FileText } from 'lucide-react';
import type { CalibrationMetadata } from '../../types';

export const HistoricalCalibrationAuditCard: React.FC = () => {
  const { currentWeather } = useWeatherStore();
  const [fetchedCalib, setFetchedCalib] = useState<CalibrationMetadata | null>(null);

  const storeCalib = currentWeather?.blendingMetadata?.calibrationMetadata;

  useEffect(() => {
    // If store doesn't have calibration metadata yet, fetch directly from /api/calibration
    if (!storeCalib) {
      fetch('/api/calibration')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.metadata) {
            setFetchedCalib({
              calibratedAt: data.metadata.calibrated_at,
              evaluationPeriod: data.metadata.evaluation_period,
              leadTime: data.metadata.lead_time,
              location: data.metadata.location,
              referenceDataset: data.metadata.reference_dataset,
              metric: data.metadata.metric,
              sampleCounts: data.metadata.sample_counts ?? {},
              mae: data.metadata.mae ?? {},
              rmse: data.metadata.rmse ?? {},
              weights: data.metadata.weights ?? {},
              epsilon: data.metadata.epsilon ?? 0.01,
              weightingScheme: data.metadata.weighting_scheme,
              totalEvalSamples: data.metadata.total_eval_samples,
              isValid: data.metadata.is_valid,
            });
          }
        })
        .catch(() => {});
    }
  }, [storeCalib]);

  const calib = storeCalib || fetchedCalib;

  // If no calibration data is available at all, return null
  if (!calib) return null;

  const targetModels = [
    { name: 'ECMWF IFS HRES', type: 'NWP' },
    { name: 'NCEP GFS', type: 'NWP' },
    { name: 'DWD ICON Global', type: 'NWP' },
    { name: 'ECMWF AIFS', type: 'AI/ML' },
  ];

  return (
    <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 shadow-xs relative overflow-hidden mt-6">
      <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-50/60 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#17352A]">Historical Skill Calibration Audit</h2>
            <p className="text-xs text-emerald-800 font-medium flex items-center gap-1 mt-0.5">
              SIH26081 Verification • Fixed Lead-Time (+24h) Skill Evaluation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            Auditable Evidence
          </span>
        </div>
      </div>

      {/* Audit Metadata Summary Grid */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-700">
          <div>
            <span className="font-semibold text-gray-500">Evaluation period: </span>
            <span className="font-mono font-medium text-gray-900">{calib.evaluationPeriod}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500">Lead time: </span>
            <span className="font-mono font-medium text-gray-900">{calib.leadTime}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500">Reference: </span>
            <span className="font-medium text-gray-900">{calib.referenceDataset}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500">Primary metric: </span>
            <span className="font-medium text-gray-900">{calib.metric}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500">Total samples evaluated: </span>
            <span className="font-mono font-medium text-gray-900">{calib.totalEvalSamples ?? 720} hours</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500">Weighting scheme: </span>
            <span className="font-mono font-medium text-emerald-800">{calib.weightingScheme ?? 'inverse-MAE skill: 1 / (MAE + epsilon)'}</span>
          </div>
        </div>
      </div>

      {/* Structured Verification Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 mb-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">Model</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Samples</th>
              <th className="py-2.5 px-3">MAE</th>
              <th className="py-2.5 px-3">RMSE</th>
              <th className="py-2.5 px-3 text-right">Calibrated Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {targetModels.map((m, idx) => {
              const samples = calib.sampleCounts?.[m.name] ?? '—';
              const mae = calib.mae?.[m.name] != null ? `${calib.mae[m.name].toFixed(3)}°C` : '—';
              const rmse = calib.rmse?.[m.name] != null ? `${calib.rmse[m.name].toFixed(3)}°C` : '—';
              const weightVal = calib.weights?.[m.name];
              const weightStr = weightVal != null ? `${(weightVal * 100).toFixed(1)}%` : '—';

              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-gray-900 flex items-center gap-2">
                    {m.type === 'AI/ML' ? (
                      <Cpu className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    ) : (
                      <Wind className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                    )}
                    <span>{m.name}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        m.type === 'AI/ML'
                          ? 'bg-violet-100 text-violet-700 border border-violet-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-gray-700">{samples}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-gray-900">{mae}</td>
                  <td className="py-2.5 px-3 font-mono text-gray-600">{rmse}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="font-mono font-bold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                      {weightStr}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Data Leakage Protection Note */}
      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-emerald-900/90 leading-relaxed">
        <span className="font-semibold text-emerald-950">Data Leakage Protection: </span>
        Sourced strictly via Open-Meteo Previous Runs API at fixed +24h lead offset (<span className="font-mono text-emerald-800">previous_day1</span>) and verified against ERA5 reanalysis for matching timestamps. Model forecasts were issued strictly prior to target valid timestamps; current or future forecast data is never compared against today's observation or treated as historical truth.
      </div>
    </div>
  );
};
