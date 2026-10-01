import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { BarChart2, Cpu, Wind, CheckCircle2, ShieldCheck, Info, Sliders } from 'lucide-react';
import { formatTemp, formatWind } from '../../utils/formatters';

/** Small pill that labels a model as NWP or AI/ML */
const ModelTypeBadge: React.FC<{ modelType?: string }> = ({ modelType }) => {
  const isAI = modelType === 'AI/ML';
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
        isAI
          ? 'bg-violet-100 text-violet-700 border border-violet-200'
          : 'bg-sky-50 text-sky-700 border border-sky-200'
      }`}
    >
      {isAI ? 'AI/ML' : 'NWP'}
    </span>
  );
};

export const MultiModelBlendingCard: React.FC = () => {
  const { currentWeather, isLoading } = useWeatherStore();

  if (isLoading || !currentWeather) return null;
  
  const blendingMetadata = currentWeather.blendingMetadata;
  if (!blendingMetadata) return null;

  const isCalibrated = blendingMetadata.calibrationMode === 'CALIBRATED';
  const calib = blendingMetadata.calibrationMetadata;
  const adaptive = blendingMetadata.adaptiveAudit;

  return (
    <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 shadow-xs relative overflow-hidden mt-6">
      <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />
      
      {/* Header with Title and Mode Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-[#17352A]">Multi-Model Forecast Blending</h2>
            {isCalibrated ? (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Historical Skill Calibration • Mumbai • +24h • 30-day evaluation
              </p>
            ) : (
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                Prototype demonstration weights — historical skill calibration pending.
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {isCalibrated ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Historical-skill calibrated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              Demonstration weights
            </span>
          )}

          {adaptive && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                adaptive.calibrationStatus === 'CALIBRATED'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Sliders className="w-3 h-3 text-blue-600" />
              Adaptive Weighting: {adaptive.calibrationStatus}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Model Contributions / Final Model Weights */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#6B7D74] uppercase tracking-wider">
              Final Model Weights
            </h3>
            {isCalibrated && (
              <span className="text-[11px] text-gray-500 font-mono">
                Inverse-MAE weighting
              </span>
            )}
          </div>

          <div className="space-y-3">
            {blendingMetadata.models.map((model, idx) => {
              const modelMae = calib?.mae?.[model.modelName];
              return (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-indigo-100 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {model.modelType === 'AI/ML'
                        ? <Cpu className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        : <Wind className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                      }
                      <span className="font-medium text-gray-900 text-sm">{model.modelName}</span>
                      <ModelTypeBadge modelType={model.modelType} />
                    </div>
                    <div className={`font-bold px-2 py-1 rounded text-sm ${
                      model.weight > 0
                        ? isCalibrated
                          ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                          : model.modelType === 'AI/ML'
                            ? 'text-violet-700 bg-violet-50'
                            : 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-400'
                    }`}>
                      {model.weight > 0 ? `${(model.weight * 100).toFixed(1)}%` : <span className="text-gray-400 text-xs uppercase">Unavailable</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 ml-5 mt-1">
                    <span>
                      T: {model.temperatureC != null ? formatTemp(model.temperatureC, '°C') : '—'} | 
                      R: {model.precipitationMm != null ? `${model.precipitationMm} mm` : '—'} | 
                      W: {model.windSpeedKmh != null ? formatWind(model.windSpeedKmh, 'km/h') : '—'}
                    </span>
                    {isCalibrated && modelMae != null && (
                      <span className="text-gray-400 font-mono text-[11px]" title="Historical Mean Absolute Error">
                        MAE: {modelMae.toFixed(2)}°C
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Blended Output */}
        <div>
          <h3 className="text-sm font-semibold text-[#6B7D74] mb-3 uppercase tracking-wider">Blended Output</h3>
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-indigo-800/70 mb-1">Temperature</div>
                <div className="text-xl font-bold text-indigo-900">
                  {blendingMetadata.blendedTemperatureC != null ? formatTemp(blendingMetadata.blendedTemperatureC, '°C') : '—'}
                </div>
              </div>
              <div className="border-l border-r border-indigo-200/50">
                <div className="text-xs text-indigo-800/70 mb-1">Rainfall</div>
                <div className="text-xl font-bold text-indigo-900">
                  {blendingMetadata.blendedPrecipitationMm != null ? `${blendingMetadata.blendedPrecipitationMm} mm` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-indigo-800/70 mb-1">Wind</div>
                <div className="text-xl font-bold text-indigo-900">
                  {blendingMetadata.blendedWindSpeedKmh != null ? formatWind(blendingMetadata.blendedWindSpeedKmh, 'km/h') : '—'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Lead time:</span>
              <span>{blendingMetadata.leadTimeHours} h</span>
            </div>
            {blendingMetadata.targetTime && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Target time:</span>
                <span className="tabular-nums">
                  {(() => {
                    try {
                      const d = new Date(blendingMetadata.targetTime.length === 13
                        ? blendingMetadata.targetTime + ':00'
                        : blendingMetadata.targetTime);
                      return isNaN(d.getTime())
                        ? blendingMetadata.targetTime
                        : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
                    } catch {
                      return blendingMetadata.targetTime;
                    }
                  })()}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Region:</span>
              <span>{blendingMetadata.region}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Weather regime:</span>
              <span className="font-semibold text-indigo-700">{blendingMetadata.weatherRegime}</span>
            </div>

            {/* Contextual Calibration Dimensions */}
            {adaptive && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-600">Adaptive calibration:</span>
                  <span className={`font-semibold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded-sm ${
                    adaptive.calibrationStatus === 'CALIBRATED'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {adaptive.calibrationStatus}
                  </span>
                </div>

                {adaptive.calibratedDimensions.length > 0 && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-500">Calibrated dimensions:</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {adaptive.calibratedDimensions.map((dim) => (
                        <span key={dim} className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                          {dim}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {adaptive.fallbackDimensions.length > 0 && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-500">Fallback dimensions:</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {adaptive.fallbackDimensions.map((dim) => (
                        <span key={dim} className="bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0.5 rounded border border-amber-200 font-mono" title="No empirical historical data yet; base skill weights preserved">
                          {dim}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {blendingMetadata.extremeWeatherIndicators.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs italic text-amber-600">
                {blendingMetadata.extremeWeatherIndicators.join(' • ')}
              </div>
            )}

            {/* Concise Methodology Explanation */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
              <div className="text-emerald-800 font-medium">
                Final weights are derived from historical model skill and contextual calibration where validated data is available.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

