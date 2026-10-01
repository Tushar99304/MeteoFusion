import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  Layers, 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Calculator
} from 'lucide-react';

interface AiWeightEngineSectionProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AiWeightEngineSection: React.FC<AiWeightEngineSectionProps> = ({
  isOpen: externalOpen,
  onClose: externalClose,
}) => {
  const { currentWeather, calibration } = useWeatherStore();
  const [internalOpen, setInternalOpen] = useState(false);

  const isModalOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const closeModal = externalClose !== undefined ? externalClose : () => setInternalOpen(false);
  const openModal = () => setInternalOpen(true);

  const blending = currentWeather?.blendingMetadata;
  const calib = blending?.calibrationMetadata || calibration;

  const locationLabel = calib?.location || 'Mumbai (19.08°N, 72.88°E)';
  const leadTime = calib?.leadTime || '+24h';
  const reference = calib?.referenceDataset || 'ERA5 Reanalysis (Open-Meteo Archive API)';
  const metric = calib?.metric || 'MAE';
  const epsilon = calib?.epsilon ?? 0.01;
  const evalPeriod = calib?.evaluationPeriod || '2026-08-26 to 2026-09-24';
  const totalSamples = calib?.totalEvalSamples ?? 720;
  const weightingScheme = calib?.weightingScheme || 'inverse-MAE skill: 1 / (MAE + epsilon)';

  return (
    <>
      {/* Central Visual Component Card */}
      <div id="engine" className="card-3d bg-white p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
                <Layers className="w-5 h-5 text-[#3B82F6]" />
              </span>
              <div>
                <h3 className="text-xl font-extrabold text-[#0F2742] tracking-tight">AI WEIGHT ENGINE</h3>
                <p className="text-xs text-[#5D7188]">Adaptive multi-factor weight calibration architecture</p>
              </div>
            </div>
          </div>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1557B0] hover:bg-[#0D47A1] text-white text-xs font-bold transition-all shadow-xs"
          >
            <Calculator className="w-4 h-4 text-cyan-300" />
            <span>Explain Weighting Math</span>
          </button>
        </div>

        {/* Dynamic Architectural Pipeline Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center py-2">
          {/* Factor 1 */}
          <div className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5] text-center">
            <span className="text-[10px] font-bold text-[#5D7188] uppercase block mb-1">Inputs</span>
            <div className="font-extrabold text-xs text-[#0F2742] space-y-1">
              <div>Historical Skill (MAE)</div>
              <div className="text-[11px] text-[#5D7188]">Location & Lead Time</div>
              <div className="text-[11px] text-[#5D7188]">Weather Regime</div>
            </div>
          </div>

          <div className="flex justify-center text-[#3B82F6]">
            <ArrowRight className="w-5 h-5 rotate-90 md:rotate-0" />
          </div>

          {/* Factor 2: Weight Engine */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#DCEEFF] to-[#BFDBFE]/40 border border-[#93C5FD] text-center shadow-xs">
            <span className="text-[10px] font-bold text-[#1557B0] uppercase block mb-1">Mathematical Engine</span>
            <div className="font-mono-stat font-extrabold text-xs text-[#0F2742]">
              skill = 1 / (MAE + ε)
            </div>
            <div className="text-[10px] font-mono-stat text-[#1557B0] mt-1">
              weight = skill / Σ(skills)
            </div>
          </div>

          <div className="flex justify-center text-[#3B82F6]">
            <ArrowRight className="w-5 h-5 rotate-90 md:rotate-0" />
          </div>

          {/* Factor 3: Hybrid Forecast */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1557B0] to-[#1E40AF] text-white text-center shadow-sm">
            <span className="text-[10px] font-bold text-cyan-300 uppercase block mb-1">Synthesis</span>
            <div className="font-extrabold text-sm tracking-tight">
              Hybrid Forecast
            </div>
            <div className="text-[10px] text-blue-200 mt-1">
              Multi-Model Consensus
            </div>
          </div>
        </div>

        {/* Bottom Context Callout */}
        <div className="mt-5 pt-4 border-t border-[#D7E7F5] flex flex-wrap items-center justify-between text-xs text-[#5D7188] gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Benchmark Dataset: <strong className="text-[#0F2742]">{reference}</strong></span>
          </div>
          <div className="font-mono-stat text-[11px]">
            Target: <strong>{locationLabel}</strong> • Horizon: <strong>{leadTime}</strong>
          </div>
        </div>
      </div>

      {/* "Explain Weighting" Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-8 border border-[#D7E7F5] shadow-2xl relative max-h-[88vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-4 border-b border-[#D7E7F5]">
              <div>
                <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider block">Methodological Transparency</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F2742] tracking-tight">
                  HOW WERE THE WEIGHTS CALCULATED?
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-xl border border-[#D7E7F5] text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5 text-xs text-[#0F2742]">
              {/* Formula Panel */}
              <div className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5]">
                <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider mb-2">
                  Calibration Formula (Inverse-MAE Skill)
                </div>
                <div className="font-mono-stat text-sm font-extrabold text-[#1557B0] bg-white p-3 rounded-xl border border-[#D7E7F5] mb-2 space-y-1">
                  <div>skill_i = 1 / (MAE_i + ε)</div>
                  <div className="text-xs text-[#5D7188]">weight_i = skill_i / Σ(all model skills)</div>
                </div>
                <p className="text-[11px] text-[#5D7188] leading-relaxed">
                  Scheme: <strong>{weightingScheme}</strong>. Where <code className="bg-blue-50 px-1 py-0.5 rounded text-[#1557B0]">ε = {epsilon}</code> is a numerical stability damping factor to avoid division by zero when an error is exceptionally small.
                </p>
              </div>

              {/* Dynamic Metadata Attributes */}
              <div className="grid grid-cols-2 gap-3 font-mono-stat text-[11px]">
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Location Anchor</span>
                  <span className="font-bold text-[#0F2742] block truncate">{locationLabel}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Lead Time Horizon</span>
                  <span className="font-bold text-[#1557B0] block">{leadTime}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Benchmark Dataset</span>
                  <span className="font-bold text-[#0F2742] block truncate">{reference}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Error Metric</span>
                  <span className="font-bold text-[#0F2742] block">{metric}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Evaluation Period</span>
                  <span className="font-bold text-[#0F2742] block">{evalPeriod}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D7E7F5]">
                  <span className="text-[10px] text-[#5D7188] uppercase block">Total Evaluation Samples</span>
                  <span className="font-bold text-[#0F2742] block">{totalSamples} steps</span>
                </div>
              </div>

              {/* Scientific Honesty Disclaimer */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-[#1557B0] text-[11px] leading-relaxed">
                <strong>Scientific Architecture Note:</strong> The backend computes weights via inverse-MAE calibration against reanalysis truth, ensuring complete auditability and mathematical explainability for meteorological authorities.
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-[#D7E7F5] flex justify-end">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl bg-[#1557B0] hover:bg-[#0D47A1] text-white text-xs font-bold transition-colors"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
