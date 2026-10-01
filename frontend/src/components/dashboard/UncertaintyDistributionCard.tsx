import React from 'react';
import { Layers, Info } from 'lucide-react';

export const UncertaintyDistributionCard: React.FC = () => {
  return (
    <div className="card-3d bg-white p-6 rounded-3xl border border-[#D7E7F5] shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider block">
          Ensemble Dispersion
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Roadmap Capability
        </span>
      </div>

      <h3 className="text-base font-extrabold text-[#0F2742] tracking-tight mb-2 flex items-center gap-1.5">
        <Layers className="w-4 h-4 text-[#3B82F6]" />
        <span>UNCERTAINTY DISTRIBUTION (P10 / P50 / P90)</span>
      </h3>

      <div className="p-3.5 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5] text-xs text-[#5D7188] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Not available from current backend:</strong> Full multi-member ensemble percentiles (P10/P50/P90 probabilistic fan charts) are planned for next-generation NWP ensemble ingestion. The current live system presents the deterministic weighted blend.
        </p>
      </div>
    </div>
  );
};
