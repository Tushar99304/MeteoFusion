import React from 'react';
import { Database, ShieldCheck, ExternalLink } from 'lucide-react';

export const DataEvidenceSection: React.FC = () => {

  const sources = [
    {
      name: 'Open-Meteo API',
      authority: 'Research / Reproducibility',
      type: 'NWP Data Ingestion',
      role: 'Weather forecasts & historical climate archive',
      url: 'https://open-meteo.com',
      badge: 'bg-blue-50 text-[#1557B0] border-[#BFDBFE]',
    },
    {
      name: 'ECMWF IFS & AIFS',
      authority: 'European Centre Medium-Range Weather',
      type: 'Physics NWP & Machine Learning NWP',
      role: 'Global high-resolution forecasting members',
      url: 'https://www.ecmwf.int',
      badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    },
    {
      name: 'NDMA SACHET',
      authority: 'Official Disaster Management Authority',
      type: 'CAP / RSS Protocol',
      role: 'Early disaster warnings & civil alerts',
      url: 'https://sachet.ndma.gov.in',
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
    },
    {
      name: 'ERA5 Reanalysis',
      authority: 'Copernicus Climate Change Service',
      type: 'Historical Reanalysis Reference',
      role: 'Ground-truth benchmark for inverse-MAE skill calibration',
      url: 'https://cds.climate.copernicus.eu',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
  ];

  return (
    <div className="card-3d bg-white p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <Database className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-[#0F2742] tracking-tight">
                DATA SOURCES & GROUNDING EVIDENCE
              </h3>
              <p className="text-xs text-[#5D7188]">
                Full audit trail of upstream meteorological authorities, models, and reanalysis baselines
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified Grounding
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sources.map((s, idx) => (
          <div key={idx} className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-extrabold text-sm text-[#0F2742]">{s.name}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5D7188] hover:text-[#3B82F6] transition-colors"
                  title="View official documentation"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border mb-2 ${s.badge}`}>
                {s.authority}
              </span>
              <p className="text-xs text-[#5D7188] leading-relaxed">
                {s.role}
              </p>
            </div>
            <div className="pt-2 border-t border-[#D7E7F5] text-[10px] text-[#5D7188] font-mono-stat">
              Protocol: {s.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
