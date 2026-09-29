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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-[#DCEAE2] space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#2E7D5B]" />
            <h3 className="font-bold text-base text-[#17352A]">Why this answer?</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7D74] hover:bg-[#E8F5EE] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#6B7D74]">
          WeatherGPT responses are grounded in verified meteorological evidence retrieved from official agencies. Here is the metadata underlying this explanation:
        </p>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-2.5 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="text-[#6B7D74] flex items-center gap-1.5"><Database className="w-4 h-4 text-[#2E7D5B]" /> Source</span>
            <SourceBadge source={evidence.source} size="sm" />
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="text-[#6B7D74] flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#2E7D5B]" /> Location</span>
            <span className="font-semibold text-[#17352A]">{evidence.location}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="text-[#6B7D74] flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#2E7D5B]" /> Retrieved (UTC)</span>
            <span className="font-semibold text-[#17352A]">{evidence.retrievedAtUtc || '—'}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="text-[#6B7D74] flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#2E7D5B]" /> Local observation time</span>
            <span className="font-semibold text-[#17352A]">{evidence.observedAt}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#E8F5EE] rounded-xl border border-[#6BAF92]/40">
            <span className="text-[#17352A] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#2E7D5B]" /> Evidence Quality</span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#2E7D5B] font-bold border border-emerald-300">
              {evidence.evidenceQuality || '—'}
            </span>
          </div>
        </div>

        <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2] text-[11px] text-[#6B7D74] leading-relaxed">
          <strong>Grounding policy:</strong> the model only ever explains this one structured
          evidence object — {evidence.temperature ?? '—'}°C, {evidence.rainfall ?? '—'} mm rain,
          {evidence.rainProbability != null ? ` ${evidence.rainfall ?? '—'} mm with ${evidence.rainProbability}% daily rain probability,` : ' daily rain probability not available,'}{' '}
          from {evidence.source} ({evidence.authority === 'official' ? 'official' : evidence.authority === 'sample' ? 'sample data' : 'research/repro model data'}).
          Every number it states is re-verified against these values before the answer is shown;
          official NDMA/SACHET alerts always outrank model weather.
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#2E7D5B] text-white rounded-xl font-semibold text-xs hover:bg-[#236347] transition-colors"
        >
          Got it, Close
        </button>
      </div>
    </div>
  );
};
