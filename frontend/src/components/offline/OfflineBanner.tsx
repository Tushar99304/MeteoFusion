import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { connection, syncData } = useWeatherStore();

  if (connection.isOnline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-md">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>No Internet Connection. Showing latest cached weather data (Last synced: {connection.lastSyncedAt || 'Offline Cache'}).</span>
      </div>
      <button
        onClick={() => syncData()}
        className="px-3 py-1 bg-white text-amber-900 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
      </button>
    </div>
  );
};
