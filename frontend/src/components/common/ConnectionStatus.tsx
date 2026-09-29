import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

/**
 * Reflects the REAL backend connection state from /health and the last query:
 * REAL (backend reachable, live evidence), DEMO (explicit sample-data mode),
 * DEGRADED (backend unreachable, no cache), OFFLINE (using cached evidence).
 */
export const ConnectionStatus: React.FC = () => {
  const { connection, syncData, usingSample, usingCached } = useWeatherStore();

  if (connection.syncInProgress) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#2E7D5B] text-xs font-medium border border-[#DCEAE2]">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2E7D5B]" />
        <span>Checking weather evidence…</span>
      </div>
    );
  }

  if (!connection.isOnline || usingCached || connection.apiStatus === 'OFFLINE') {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200">
        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
        <span>Offline {connection.lastSyncedAt ? `· cached ${connection.lastSyncedAt}` : '· no cache'}</span>
      </div>
    );
  }

  if (usingSample || connection.apiStatus === 'DEMO') {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Sample demo data</span>
      </div>
    );
  }

  if (connection.apiStatus === 'DEGRADED') {
    return (
      <button
        onClick={() => syncData()}
        title="Backend not reachable — click to retry"
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200 hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Backend unreachable · retry</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => syncData()}
      title="Click to refresh evidence from the WeatherGPT backend"
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#2E7D5B] text-xs font-medium border border-[#6BAF92]/40 hover:bg-[#2E7D5B] hover:text-white transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <Wifi className="w-3.5 h-3.5" />
      <span>Live · {connection.lastSyncedAt || 'connecting…'}</span>
    </button>
  );
};
