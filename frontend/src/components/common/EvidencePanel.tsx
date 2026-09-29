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
      <div className="bg-[#E8F5EE]/60 border border-[#DCEAE2] rounded-lg p-3 text-xs text-[#17352A] space-y-1">
        <div className="flex items-center justify-between mb-2">
          <SourceBadge source={evidence.source} authority={evidence.authority} size="sm" />
          {evidence.evidenceQuality && (
            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${qualityColor}`}>
              Evidence quality: {evidence.evidenceQuality}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[#6B7D74]">
          <div>
            <span className="font-medium text-[#17352A]">Observed:</span> {evidence.observedAt}
          </div>
          <div>
            <span className="font-medium text-[#17352A]">Location:</span> {evidence.location}
          </div>
        </div>
        <p className="text-[10px] text-[#6B7D74] flex items-center gap-1">
          {evidence.authority === 'sample' ? <FlaskConical className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          {sourceNote}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#DCEAE2] rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#2E7D5B]" />
          <h4 className="font-semibold text-sm text-[#17352A]">Weather Evidence Record</h4>
        </div>
        <SourceBadge source={evidence.source} authority={evidence.authority} size="md" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-[#F7FBF8] p-2.5 rounded-lg border border-[#DCEAE2]/60">
          <div className="text-[#6B7D74] mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Location
          </div>
          <div className="font-semibold text-[#17352A] truncate">{evidence.location}</div>
        </div>

        <div className="bg-[#F7FBF8] p-2.5 rounded-lg border border-[#DCEAE2]/60">
          <div className="text-[#6B7D74] mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Observed at
          </div>
          <div className="font-semibold text-[#17352A]">{evidence.observedAt}</div>
        </div>

        <div className="bg-[#F7FBF8] p-2.5 rounded-lg border border-[#DCEAE2]/60">
          <div className="text-[#6B7D74] mb-1">Source type</div>
          <div className="font-semibold text-[#2E7D5B]">{sourceNote}</div>
        </div>

        <div className="bg-[#F7FBF8] p-2.5 rounded-lg border border-[#DCEAE2]/60">
          <div className="text-[#6B7D74] mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Evidence quality
          </div>
          {evidence.evidenceQuality ? (
            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${qualityColor}`}>
              {evidence.evidenceQuality}
            </span>
          ) : (
            <span className="font-semibold text-[#6B7D74]">—</span>
          )}
        </div>
      </div>

      <div className="bg-[#E8F5EE] rounded-lg p-3 text-xs text-[#17352A] flex flex-wrap items-center justify-between gap-2">
        <span>
          Verified metrics: <strong>{evidence.rainfall ?? '—'} mm</strong> rain,{' '}
          <strong>{evidence.humidity ?? '—'}%</strong> humidity,{' '}
          <strong>{evidence.windSpeed ?? '—'} km/h</strong> wind,{' '}
          <strong>{evidence.temperature ?? '—'}°C</strong>
        </span>
        {evidence.providerModel && (
          <span className="text-[#6B7D74] text-[11px]">model: {evidence.providerModel}</span>
        )}
      </div>
    </div>
  );
};
