import React, { useState } from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { AlertCard } from '../components/alerts/AlertCard';
import { 
  Radio, 
  CheckCircle2, 
  History, 
  CloudOff, 
  FlaskConical, 
  ShieldAlert, 
  Compass
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts, expiredAlerts, usingSample, currentLocation, connection, advisory } = useWeatherStore();
  const [showExpired, setShowExpired] = useState(false);

  const activeAlerts = alerts.filter(a => a.validity === 'active');
  const activeCount = activeAlerts.length;
  const highSeverityCount = activeAlerts.filter(
    (a) => a.severity === 'Extreme' || a.severity === 'Severe' || a.severity === 'WARNING',
  ).length;
  const alertsUnavailable = !usingSample && connection.apiStatus !== 'REAL' && activeCount === 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              Authoritative Early Warning Network
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2742] tracking-tight">
            Official Disaster & Meteorological Warnings
          </h1>
          <p className="text-xs sm:text-sm text-[#5D7188] mt-1 font-medium">
            Verified NDMA SACHET CAP notifications for {currentLocation.name}. Official alerts supersede NWP forecasts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {usingSample ? (
            <span className="px-3.5 py-2 bg-amber-50 text-amber-900 text-xs font-bold rounded-2xl border border-amber-300 flex items-center gap-1.5 shadow-2xs">
              <FlaskConical className="w-4 h-4 text-amber-600" />
              <span>SAMPLE DATA MODE</span>
            </span>
          ) : (
            <span className="px-3.5 py-2 bg-emerald-50 text-emerald-900 text-xs font-bold rounded-2xl border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>NDMA SACHET Live Protocol</span>
            </span>
          )}
        </div>
      </div>

      {usingSample && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            You are viewing bundled SAMPLE disaster alerts. Toggle off demo mode to query live NDMA SACHET CAP feeds for current coordinates.
          </span>
        </div>
      )}

      {alertsUnavailable && (
        <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-8 text-center space-y-2">
          <CloudOff className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0F2742]">
            Upstream Alert Feed Currently Unreachable
          </h3>
          <p className="text-xs text-[#5D7188] max-w-md mx-auto leading-relaxed">
            NDMA SACHET could not be verified for this request interval. In accordance with safety policies, MeteoFusion does not assert the absence of risk without verified upstream data.
          </p>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-3d bg-white p-5 rounded-3xl border border-[#D7E7F5] shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-[#1557B0] rounded-2xl font-mono-stat font-extrabold text-2xl">
            {activeCount}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#5D7188]">Active Official Alerts</span>
            <p className="text-sm font-extrabold text-[#0F2742]">Coordinate Verified</p>
          </div>
        </div>

        <div className="card-3d bg-white p-5 rounded-3xl border border-[#D7E7F5] shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl font-mono-stat font-extrabold text-2xl">
            {highSeverityCount}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#5D7188]">Severe / Extreme</span>
            <p className="text-sm font-extrabold text-rose-700">High-Priority Protocols</p>
          </div>
        </div>

        <div className="card-3d bg-white p-5 rounded-3xl border border-[#D7E7F5] shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-slate-50 text-slate-700 rounded-2xl font-mono-stat font-extrabold text-2xl">
            {expiredAlerts.length}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#5D7188]">Expired on Record</span>
            <p className="text-sm font-extrabold text-slate-700">Transparency Only</p>
          </div>
        </div>
      </div>

      {/* Active Official Alerts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-[#0F2742] flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>Active Official Disaster Alerts (NDMA SACHET)</span>
          </h2>
          <span className="text-xs font-mono-stat text-[#5D7188]">
            Priority Level: 1 (Authoritative)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}

          {activeAlerts.length === 0 && !alertsUnavailable && (
            <div className="col-span-full card-3d bg-white border border-[#D7E7F5] rounded-3xl p-10 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-extrabold text-base text-[#0F2742]">
                No Active Official Alerts for {currentLocation.name}
              </h3>
              <p className="text-xs text-[#5D7188] max-w-lg mx-auto leading-relaxed">
                NDMA SACHET feeds have been queried. No active disaster warnings currently apply to this geographic polygon.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Model-Derived Advisory Risk Guidance (Distinct Separation) */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="font-extrabold text-base text-[#0F2742]">
              MODEL-DERIVED RISK GUIDANCE (DETERMINISTIC HEURISTICS)
            </h3>
          </div>
          <span className="text-[10px] font-mono-stat font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1557B0] border border-[#BFDBFE]">
            Secondary Advisory Tier
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5]">
            <span className="text-[10px] font-bold text-[#5D7188] uppercase block mb-1">Evaluated Activity</span>
            <div className="font-extrabold text-sm text-[#0F2742]">{advisory?.activity || 'General Travel & Daily'}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5]">
            <span className="text-[10px] font-bold text-[#5D7188] uppercase block mb-1">Assessed Risk Tier</span>
            <div className="font-extrabold text-sm text-[#1557B0]">{advisory?.riskLevel || 'LOW'}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5]">
            <span className="text-[10px] font-bold text-[#5D7188] uppercase block mb-1">Rules Evaluated</span>
            <div className="font-extrabold text-sm text-[#0F2742]">{advisory?.rulesFired?.length || 0} safety gates</div>
          </div>
        </div>

        <p className="text-xs text-[#5D7188] leading-relaxed">
          {advisory?.primaryRiskReason || 'Deterministic weather models indicate conditions within normal parameters.'}
        </p>
      </div>

      {/* Expired Alerts Transparency Section */}
      {expiredAlerts.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowExpired((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-[#1557B0] hover:text-[#0D47A1] transition-colors"
          >
            <History className="w-4 h-4 text-[#3B82F6]" />
            <span>{showExpired ? 'Hide' : 'Show'} {expiredAlerts.length} Expired Historical Alert Records (Transparency Archive)</span>
          </button>

          {showExpired && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
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
