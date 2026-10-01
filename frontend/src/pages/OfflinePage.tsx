import React from 'react';
import { OfflineCenter } from '../components/offline/OfflineCenter';
import { WifiOff, Database } from 'lucide-react';

export const OfflinePage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-[#D7E7F5] shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 mb-2">
          <Database className="w-3.5 h-3.5 text-amber-600" />
          <span>Local Persistence & Cache Store</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F2742] flex items-center gap-2.5">
          <WifiOff className="w-6 h-6 text-amber-600" />
          Offline Resilience & Cached Evidence
        </h1>
        <p className="text-xs text-[#5D7188] mt-1 leading-relaxed">
          Displays the last synchronized meteorological observations and NDMA SACHET emergency action protocols
          when field internet connectivity is severed. Weather observations are strictly preserved from the last sync;
          the platform never generates speculative offline estimates.
        </p>
      </div>

      <OfflineCenter />
    </div>
  );
};
