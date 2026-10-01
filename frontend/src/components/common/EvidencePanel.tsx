import React from 'react';
import type { WeatherEvidence } from '../../types';
import { SourceBadge } from './SourceBadge';
import { ShieldAlert, Clock, MapPin, CheckCircle2, FlaskConical } from 'lucide-react';

interface EvidencePanelProps {
  evidence: WeatherEvidence;
  compact?: boolean;
}

/**
 * Renders the evidence record the answer was grounded in. All values come from the backend
 * Evidence object; anything the evidence did not contain is shown as "—" rather than filled.
 */
export const EvidencePanel: React.FC<EvidencePanelProps> = ({ evidence, compact = false }) => {
  let qualityColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (evidence.evidenceQuality === 'MEDIUM') {
    qualityColor = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (evidence.evidenceQuality === 'LOW') {
    qualityColor = 'bg-red-100 text-red-800 border-red-300';
  }

  const sourceNote = evidence.authority === 'official'
    ? 'official source'
    : evidence.authority === 'sample'
    ? 'SAMPLE demo data'
    : 'model data · research/repro';

  if (compact) {
    return (
      <div className="bg-[#DCEEFF]/30 border border-[#D7E7F5] rounded-xl p-3 text-xs text-[#0F2742] space-y-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <SourceBadge source={evidence.source} authority={evidence.authority} size="sm" />
          {evidence.evidenceQuality && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider font-mono ${qualityColor}`}>
              Quality: {evidence.evidenceQuality}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[#5D7188]">
          <div>
            <span className="font-semibold text-[#0F2742]">Observed:</span> {evidence.observedAt}
          </div>
          <div>
            <span className="font-semibold text-[#0F2742]">Location:</span> {evidence.location}
          </div>
        </div>
        <p className="text-[10px] text-[#5D7188] flex items-center gap-1 font-mono">
          {evidence.authority === 'sample' ? <FlaskConical className="w-3 h-3 text-amber-600" /> : <ShieldAlert className="w-3 h-3 text-[#3B82F6]" />}
          {sourceNote}
        </p>
      </div>
    );
  }

  return (
    <div className="card-3d bg-white border border-[#D7E7F5] rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#3B82F6]" />
          <h4 className="font-semibold text-sm text-[#0F2742]">Weather Evidence Record</h4>
        </div>
        <SourceBadge source={evidence.source} authority={evidence.authority} size="md" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-[#F5FAFF] p-2.5 rounded-lg border border-[#D7E7F5]">
          <div className="text-[#5D7188] mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#3B82F6]" /> Location
          </div>
          <div className="font-semibold text-[#0F2742] truncate">{evidence.location}</div>
        </div>

        <div className="bg-[#F5FAFF] p-2.5 rounded-lg border border-[#D7E7F5]">
          <div className="text-[#5D7188] mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#3B82F6]" /> Observed at
          </div>
          <div className="font-semibold text-[#0F2742]">{evidence.observedAt}</div>
        </div>

        <div className="bg-[#F5FAFF] p-2.5 rounded-lg border border-[#D7E7F5]">
          <div className="text-[#5D7188] mb-1">Source type</div>
          <div className="font-semibold text-[#1557B0]">{sourceNote}</div>
        </div>

        <div className="bg-[#F5FAFF] p-2.5 rounded-lg border border-[#D7E7F5]">
          <div className="text-[#5D7188] mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> Evidence quality
          </div>
          {evidence.evidenceQuality ? (
            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider font-mono ${qualityColor}`}>
              {evidence.evidenceQuality}
            </span>
          ) : (
            <span className="font-semibold text-[#5D7188]">—</span>
          )}
        </div>
      </div>

      <div className="bg-[#DCEEFF]/40 border border-[#D7E7F5] rounded-lg p-3 text-xs text-[#0F2742] flex flex-wrap items-center justify-between gap-2">
        <span>
          Ground truth metrics: <strong>{evidence.rainfall ?? '—'} mm</strong> rain,{' '}
          <strong>{evidence.humidity ?? '—'}%</strong> humidity,{' '}
          <strong>{evidence.windSpeed ?? '—'} km/h</strong> wind,{' '}
          <strong>{evidence.temperature ?? '—'}°C</strong>
        </span>
        {evidence.providerModel && (
          <span className="text-[#5D7188] text-[11px] font-mono">model: {evidence.providerModel}</span>
        )}
      </div>
    </div>
  );
};
