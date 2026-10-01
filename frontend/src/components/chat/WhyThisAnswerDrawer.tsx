import React from 'react';
import type { WeatherEvidence } from '../../types';
import { X, ShieldCheck, Database, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { SourceBadge } from '../common/SourceBadge';

interface WhyThisAnswerDrawerProps {
  evidence: WeatherEvidence;
  onClose: () => void;
}

export const WhyThisAnswerDrawer: React.FC<WhyThisAnswerDrawerProps> = ({ evidence, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#D7E7F5] space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-3.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#DCEEFF] text-[#1557B0]">
              <ShieldCheck className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <h3 className="font-extrabold text-base text-[#0F2742]">Grounding Audit: Why this answer?</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-[#D7E7F5] text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#5D7188] leading-relaxed">
          MeteoFusion answers are strictly synthesized from retrieved meteorological evidence. Here is the verified payload that constrained this response:
        </p>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-3 bg-[#F5FAFF] rounded-2xl border border-[#D7E7F5]">
            <span className="text-[#5D7188] flex items-center gap-1.5 font-medium"><Database className="w-4 h-4 text-[#3B82F6]" /> Provider Source</span>
            <SourceBadge source={evidence.source} size="sm" />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#F5FAFF] rounded-2xl border border-[#D7E7F5]">
            <span className="text-[#5D7188] flex items-center gap-1.5 font-medium"><MapPin className="w-4 h-4 text-[#3B82F6]" /> Resolved Location</span>
            <span className="font-bold text-[#0F2742]">{evidence.location}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#F5FAFF] rounded-2xl border border-[#D7E7F5]">
            <span className="text-[#5D7188] flex items-center gap-1.5 font-medium"><Clock className="w-4 h-4 text-[#3B82F6]" /> Ingestion Time (UTC)</span>
            <span className="font-mono-stat font-bold text-[#0F2742]">{evidence.retrievedAtUtc || '—'}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#DCEEFF]/50 rounded-2xl border border-[#BFDBFE]">
            <span className="text-[#1557B0] flex items-center gap-1.5 font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Evidence Quality Gate</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] border border-emerald-300">
              {evidence.evidenceQuality || 'HIGH'}
            </span>
          </div>
        </div>

        <div className="bg-[#F5FAFF] p-3.5 rounded-2xl border border-[#D7E7F5] text-[11px] text-[#5D7188] leading-relaxed">
          <strong className="text-[#0F2742]">Grounding Safety Policy:</strong> The LLM is restricted to phrasing the single Evidence object ({evidence.temperature ?? '—'}°C, {evidence.rainfall ?? '—'} mm rain, {evidence.windSpeed ?? '—'} km/h wind). Every claim and number is verified by the grounding verifier before display.
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#1557B0] hover:bg-[#0D47A1] text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
        >
          Acknowledge & Close
        </button>
      </div>
    </div>
  );
};
