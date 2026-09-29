import React from 'react';
import { OfflineCenter } from '../components/offline/OfflineCenter';
import { WifiOff } from 'lucide-react';

export const OfflinePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
          <WifiOff className="w-6 h-6 text-amber-600" />
          Offline Meteorological Resilience Center
        </h1>
        <p className="text-xs text-[#6B7D74]">
          Cached weather snapshots and local emergency disaster protocols available without active network connectivity
        </p>
      </div>

      <OfflineCenter />
    </div>
  );
};
