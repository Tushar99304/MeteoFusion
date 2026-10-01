import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { RefreshCw, Wifi, Clock, AlertTriangle } from 'lucide-react';

/**
 * 1. Backend Connectivity Badge
 * Reflects whether the FastAPI backend is currently reachable and responsive:
 * - Reachable -> LIVE BACKEND
 * - Unreachable -> BACKEND OFFLINE
 */
export const BackendConnectivityBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { connection, checkHealth, syncData } = useWeatherStore();
  const isReachable = connection.backendReachable && connection.apiStatus !== 'OFFLINE';

  if (isReachable) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-2xs ${className}`}
        title="FastAPI backend is reachable and responsive"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>LIVE BACKEND</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        void checkHealth();
        void syncData();
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs ${className}`}
      title="FastAPI backend is unreachable — click to retry connection"
    >
      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
      <span>BACKEND OFFLINE</span>
    </button>
  );
};

/**
 * 2. Weather Data Freshness Badge
 * Reflects the freshness of the latest weather request:
 * - Fresh data returned -> LIVE WEATHER · Updated HH:MM
 * - Provider failed but cached snapshot is displayed -> CACHED WEATHER · HH:MM
 * - Sync in progress -> Syncing Weather…
 * - Explicit Demo/Sample mode -> DEMO WEATHER · Sample
 */
export const WeatherFreshnessBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { connection, usingCached, usingSample, syncData, currentWeather, lastQueriedAt } = useWeatherStore();

  if (connection.syncInProgress) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#1557B0] text-xs font-medium border border-[#D7E7F5] shadow-2xs ${className}`}
        title="Synchronizing weather evidence from provider"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3B82F6] shrink-0" />
        <span>Syncing Weather…</span>
      </div>
    );
  }

  if (usingSample || connection.apiStatus === 'DEMO') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold border border-sky-200 shadow-2xs ${className}`}
        title="Displaying bundled demonstration sample data"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        <span>DEMO WEATHER · Sample</span>
      </div>
    );
  }

  if (usingCached) {
    const time =
      connection.lastSyncedAt ||
      lastQueriedAt ||
      (currentWeather?.observedAt && currentWeather.observedAt !== '—' ? currentWeather.observedAt : '00:00');

    return (
      <button
        onClick={() => void syncData()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-900 text-xs font-semibold border border-amber-200 hover:bg-amber-100 transition-colors shadow-2xs ${className}`}
        title="Weather provider failed; displaying cached snapshot — click to retry"
      >
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>CACHED WEATHER · {time}</span>
      </button>
    );
  }

  if (currentWeather) {
    const time =
      connection.lastSyncedAt ||
      lastQueriedAt ||
      (currentWeather.observedAt && currentWeather.observedAt !== '—' ? currentWeather.observedAt : 'recent');

    return (
      <button
        onClick={() => void syncData()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/80 text-[#1557B0] text-xs font-semibold border border-[#BFDBFE] hover:bg-[#DCEEFF] transition-colors shadow-2xs ${className}`}
        title="Live weather provider data — click to refresh"
      >
        <Wifi className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
        <span>LIVE WEATHER · Updated {time}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => void syncData()}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs ${className}`}
      title="No weather data available — click to fetch"
    >
      <RefreshCw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>FETCH WEATHER</span>
    </button>
  );
};

/**
 * Composite ConnectionStatus rendering both Backend Connectivity and Weather Freshness.
 */
export const ConnectionStatus: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <BackendConnectivityBadge />
      <WeatherFreshnessBadge />
    </div>
  );
};
