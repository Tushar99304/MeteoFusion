import React, { useState } from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { AlertCard } from '../components/alerts/AlertCard';
import { AlertTriangle, Radio, CheckCircle2, History, CloudOff, FlaskConical } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts, expiredAlerts, usingSample, currentLocation, connection } = useWeatherStore();
  const [showExpired, setShowExpired] = useState(false);

  const activeCount = alerts.length;
  const highSeverityCount = alerts.filter(
    (a) => a.severity === 'Extreme' || a.severity === 'Severe' || a.severity === 'WARNING',
  ).length;
  const alertsUnavailable = !usingSample && connection.apiStatus !== 'REAL' && activeCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            Official Disaster & Weather Alerts
          </h1>
          <p className="text-xs text-[#6B7D74]">
            NDMA SACHET CAP alerts for {currentLocation.name}. Official alerts always take
            precedence over model weather.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {usingSample ? (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-300 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> SAMPLE DATA
            </span>
          ) : (
            <span className="px-3 py-1 bg-[#E8F5EE] text-[#2E7D5B] text-xs font-bold rounded-lg border border-[#6BAF92]/40 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> CAP checked via backend
            </span>
          )}
        </div>
      </div>

      {usingSample && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs font-medium">
          You are viewing bundled SAMPLE demo alerts, not official SACHET records. Turn off Sample
          Data mode to use the live NDMA SACHET feed through the backend.
        </div>
      )}

      {alertsUnavailable && (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-6 text-center space-y-2">
          <CloudOff className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="font-bold text-sm text-[#17352A]">
            The official alert service could not be verified
          </p>
          <p className="text-xs text-[#6B7D74] max-w-md mx-auto">
            SACHET could not be reached for this run. That is <strong>not</strong> the same as
            “no alerts exist” — WeatherGPT will not claim the area is clear when it could not
            check. Retry when connectivity is restored.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#DCEAE2] p-4 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-[#E8F5EE] text-[#2E7D5B] rounded-xl font-bold text-xl">
            {activeCount}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#6B7D74]">Active alerts</span>
            <p className="text-xs text-[#17352A] font-bold">Verified for this location</p>
          </div>
        </div>

        <div className="bg-white border border-[#DCEAE2] p-4 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-xl font-bold text-xl">
            {highSeverityCount}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#6B7D74]">Severe / Extreme</span>
            <p className="text-xs text-red-700 font-bold">Highest-priority alerts</p>
          </div>
        </div>

        <div className="bg-white border border-[#DCEAE2] p-4 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-xl">
            {expiredAlerts.length}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#6B7D74]">Expired on record</span>
            <p className="text-xs text-gray-700 font-bold">Transparency only — not active</p>
          </div>
        </div>
      </div>

      {/* Active alerts */}
      <div className="space-y-3">
        <h2 className="font-bold text-sm text-[#17352A] flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-600" /> Active official alerts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}

          {alerts.length === 0 && !alertsUnavailable && (
            <div className="col-span-full bg-white border border-[#DCEAE2] rounded-2xl p-8 text-center text-xs text-[#6B7D74] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#2E7D5B] mx-auto" />
              <p className="font-bold text-sm text-[#17352A]">No active alerts verifiably tied to this location</p>
              <p>
                SACHET was checked and no active official alert applied here. This is a checked
                result — not a guarantee that no alert exists anywhere nearby.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Expired transparency section */}
      {expiredAlerts.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowExpired((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-[#6B7D74] hover:text-[#17352A] transition-colors"
          >
            <History className="w-4 h-4" />
            {showExpired ? 'Hide' : 'Show'} {expiredAlerts.length} expired alert record(s)
            (transparency only)
          </button>
          {showExpired && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expiredAlerts.map((alert) => (
                <AlertCard key={`exp-${alert.id}`} alert={alert} expired />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
