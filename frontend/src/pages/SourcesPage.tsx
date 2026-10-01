import React, { useEffect, useState } from 'react';
import { DATA_SOURCES } from '../constants/sources';
import { SourceBadge } from '../components/common/SourceBadge';
import { fetchHealth } from '../services/backendClient';
import type { BackendHealth } from '../types/backend';
import { Database, ShieldCheck, Lock, Radio, CircleCheck, CircleX } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  LIVE: 'bg-[#DCEEFF]/50 text-[#1557B0] border-[#3B82F6]/30',
  REGISTRY_STUB: 'bg-amber-50 text-amber-800 border-amber-200',
  NOT_CONNECTED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const SourcesPage: React.FC = () => {
  const [health, setHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-[#D7E7F5] shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCEEFF]/40 border border-[#D7E7F5] text-xs font-semibold text-[#1557B0] mb-2">
          <Database className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Operational Provenance & Audit Trail</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F2742] flex items-center gap-2.5">
          Data Sources & Evidence Provenance
        </h1>
        <p className="text-xs text-[#5D7188] mt-1 leading-relaxed">
          MeteoFusion grounds all meteorological guidance strictly in retrieved upstream data and verified reanalysis.
          Every forecast parameter, calibration parameter, and disaster alert traces back to an identifiable authority.
        </p>
      </div>

      <div className="card-3d bg-[#DCEEFF]/30 border border-[#3B82F6]/30 rounded-2xl p-5 shadow-xs space-y-3 text-xs text-[#0F2742]">
        <div className="font-bold text-sm flex items-center gap-2 text-[#1557B0]">
          <ShieldCheck className="w-5 h-5 text-[#3B82F6]" /> Scientific Grounding & Safety Principles
        </div>
        <p className="leading-relaxed font-medium text-[#5D7188]">
          Official NDMA/SACHET disaster alerts always supersede NWP model outputs. The AI/LLM engine never acts as a weather
          source — it synthesizes explanations exclusively from the structured multi-model evidence bundle. Open-Meteo provides
          research/reproducibility multi-model forecast streams (ECMWF, GFS, ICON, AIFS); historical calibration evaluates against
          ERA5 Reanalysis. No official IMD telemetry feed is currently exposed in this environment.
        </p>
        {health && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D7E7F5] font-semibold text-[#0F2742] shadow-2xs">
              Weather provider: <span className="font-mono text-[#1557B0]">{health.weather_provider}</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D7E7F5] font-semibold flex items-center gap-1 text-[#0F2742] shadow-2xs">
              LLM reasoning engine:{' '}
              {health.llm?.configured ? (
                <CircleCheck className="w-3.5 h-3.5 text-[#16A34A]" />
              ) : (
                <CircleX className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className={health.llm?.configured ? 'text-[#16A34A]' : 'text-amber-700'}>
                {health.llm?.configured ? 'configured (Groq)' : 'deterministic fallback'}
              </span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D7E7F5] font-semibold text-[#0F2742] shadow-2xs">
              SACHET alerts feed: <span className="font-mono text-[#1557B0]">{health.alerts?.enabled ? 'active' : 'disabled'}</span>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DATA_SOURCES.map((source) => (
          <div key={source.id} className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-3">
                <div>
                  <h3 className="font-bold text-base text-[#0F2742] flex items-center gap-2">
                    {source.id === 'ndma' && <Radio className="w-4 h-4 text-red-600 animate-pulse" />}
                    {source.name}
                  </h3>
                  <span className="text-[11px] text-[#5D7188]">{source.fullName}</span>
                </div>
                {source.id === 'ndma' ? (
                  <SourceBadge source="NDMA SACHET" size="sm" />
                ) : source.status === 'NOT_CONNECTED' ? (
                  <span className="text-[11px] font-bold text-gray-400">Not connected</span>
                ) : (
                  <SourceBadge source={source.name} size="sm" />
                )}
              </div>

              <p className="text-xs text-[#5D7188] leading-relaxed">{source.description}</p>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider font-mono">Provides:</span>
                <div className="flex flex-wrap gap-1.5">
                  {source.dataProvided.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[#F5FAFF] border border-[#D7E7F5] text-[11px] text-[#0F2742]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#5D7188] border-t border-[#D7E7F5] pt-3 mt-2">
              <span className="flex items-center gap-1 font-semibold text-[#0F2742]">
                <CircleCheck className="w-3.5 h-3.5 text-[#3B82F6]" /> {source.authorityLevel.replace(/_/g, ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide uppercase font-mono ${STATUS_STYLE[source.status] || ''}`}>
                {source.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-5 shadow-xs text-xs text-[#5D7188] space-y-2">
        <div className="font-bold text-[#0F2742] flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#1557B0]" /> Architecture & Secret Management
        </div>
        <p className="leading-relaxed">
          Zero API credentials or secrets are bundled in the frontend client. The application interacts with the FastAPI
          backend (configured via <code className="px-1.5 py-0.5 bg-[#F5FAFF] border border-[#D7E7F5] rounded text-[#0F2742] font-mono">VITE_API_BASE_URL</code>);
          the backend executes provider retrieval, inverse-MAE weighted blending, and NDMA alert validation securely server-side.
        </p>
      </div>
    </div>
  );
};
