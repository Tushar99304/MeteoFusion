import React, { useEffect, useState } from 'react';
import { DATA_SOURCES } from '../constants/sources';
import { SourceBadge } from '../components/common/SourceBadge';
import { fetchHealth } from '../services/backendClient';
import type { BackendHealth } from '../types/backend';
import { Database, ShieldCheck, Lock, Radio, CircleCheck, CircleX } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  LIVE: 'bg-[#E8F5EE] text-[#2E7D5B] border-[#6BAF92]/40',
  REGISTRY_STUB: 'bg-amber-50 text-amber-800 border-amber-200',
  NOT_CONNECTED: 'bg-gray-100 text-gray-600 border-gray-300',
};

export const SourcesPage: React.FC = () => {
  const [health, setHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
          <Database className="w-6 h-6 text-[#2E7D5B]" />
          Data Sources & Provenance
        </h1>
        <p className="text-xs text-[#6B7D74]">
          WeatherGPT grounds answers in retrieved evidence. This page states exactly what is — and
          is not — connected in the current build.
        </p>
      </div>

      <div className="bg-[#E8F5EE] border border-[#6BAF92]/40 rounded-2xl p-5 shadow-xs space-y-2 text-xs text-[#17352A]">
        <div className="font-bold text-sm flex items-center gap-2 text-[#2E7D5B]">
          <ShieldCheck className="w-5 h-5" /> Grounding & safety principles
        </div>
        <p className="leading-relaxed font-medium">
          Official NDMA/SACHET alerts always outrank model weather. The LLM is never a weather
          source — it explains the single structured evidence object and every claim is verified
          against it. Open-Meteo is research/reproducibility data; no official IMD feed is wired in,
          so nothing is attributed to IMD.
        </p>
        {health && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-2 py-1 rounded-lg bg-white border border-[#DCEAE2] font-semibold">
              Weather provider: {health.weather_provider}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white border border-[#DCEAE2] font-semibold flex items-center gap-1">
              LLM explanation:{' '}
              {health.llm?.configured ? (
                <CircleCheck className="w-3.5 h-3.5 text-[#2E7D5B]" />
              ) : (
                <CircleX className="w-3.5 h-3.5 text-amber-600" />
              )}
              {health.llm?.configured ? 'configured' : 'not configured (deterministic fallback)'}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white border border-[#DCEAE2] font-semibold">
              SACHET alerts: {health.alerts?.enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DATA_SOURCES.map((source) => (
          <div key={source.id} className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#17352A] flex items-center gap-2">
                  {source.id === 'ndma' && <Radio className="w-4 h-4 text-red-600" />}
                  {source.name}
                </h3>
                <span className="text-[11px] text-[#6B7D74]">{source.fullName}</span>
              </div>
              {source.id === 'ndma' ? (
                <SourceBadge source="NDMA SACHET" size="sm" />
              ) : source.status === 'NOT_CONNECTED' ? (
                <span className="text-[11px] font-bold text-gray-500">Not connected</span>
              ) : (
                <SourceBadge source={source.name} size="sm" />
              )}
            </div>

            <p className="text-xs text-[#17352A] leading-relaxed">{source.description}</p>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-[#6B7D74] uppercase tracking-wider">Provides:</span>
              <div className="flex flex-wrap gap-1.5">
                {source.dataProvided.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[#F7FBF8] border border-[#DCEAE2] text-[11px] text-[#17352A]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#6B7D74] border-t border-[#DCEAE2] pt-2">
              <span className="flex items-center gap-1 font-semibold">
                <CircleCheck className="w-3.5 h-3.5" /> {source.authorityLevel.replace(/_/g, ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${STATUS_STYLE[source.status]}`}>
                {source.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs text-xs text-[#6B7D74] space-y-2">
        <div className="font-bold text-[#17352A] flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#2E7D5B]" /> Security & secrets
        </div>
        <p className="leading-relaxed">
          No API keys or secrets reside in the frontend. The browser only calls the FastAPI
          backend (configured via <code>VITE_API_BASE_URL</code>, default same-origin); the
          backend holds the optional Groq LLM key and performs all retrieval, validation, advisory
          and grounding work.
        </p>
      </div>
    </div>
  );
};
