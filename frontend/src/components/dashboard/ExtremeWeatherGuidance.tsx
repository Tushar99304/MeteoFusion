import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';

export const ExtremeWeatherGuidance: React.FC = () => {
  const { alerts, currentWeather, advisory, setActiveAlertModal } = useWeatherStore();

  const activeAlerts = alerts.filter(a => a.validity === 'active');
  const blending = currentWeather?.blendingMetadata;
  const indicators = blending?.extremeWeatherIndicators || [];

  const riskLevel = advisory?.riskLevel || 'LOW';
  const riskColor = {
    LOW: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-300',
    HIGH: 'bg-rose-50 text-rose-800 border-rose-300',
    UNCERTAIN: 'bg-slate-50 text-slate-800 border-slate-300',
  }[riskLevel];

  return (
    <div className="card-3d bg-white p-6 lg:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-[#1557B0]">
              <AlertTriangle className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-[#0F2742] tracking-tight">
                EXTREME WEATHER GUIDANCE & DECISION SUPPORT
              </h3>
              <p className="text-xs text-[#5D7188]">
                Dual-channel separation: Authoritative Official Disaster Alerts vs Model-Derived Advisory Risk
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold border ${riskColor}`}>
            Risk Level: {riskLevel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Official Alerts (NDMA SACHET) */}
        <div className="p-5 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#D7E7F5]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2742]">
                OFFICIAL DISASTER ALERTS
              </span>
            </div>
            <span className="text-[10px] font-mono-stat font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              NDMA SACHET (CAP)
            </span>
          </div>

          {activeAlerts.length > 0 ? (
            <div className="space-y-3">
              {activeAlerts.map((alt) => (
                <div 
                  key={alt.id}
                  onClick={() => setActiveAlertModal(alt)}
                  className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs hover:border-rose-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-extrabold text-xs text-rose-900">{alt.title}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {alt.severity}
                    </span>
                  </div>
                  <p className="text-xs text-[#5D7188] line-clamp-2 mb-2">
                    {alt.officialMessage || alt.weatherEvidenceSummary}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#5D7188] font-mono-stat">
                    <span>Area: {alt.affectedArea}</span>
                    <span className="text-[#1557B0] flex items-center gap-1 font-sans font-semibold">
                      Full Instruction <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-white border border-[#D7E7F5] text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <div className="font-bold text-xs text-[#0F2742]">No Official Disaster Warnings Active</div>
              <p className="text-[11px] text-[#5D7188]">
                Checked NDMA SACHET feeds for current location; zero active warnings detected.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Model-Derived Risk Guidance */}
        <div className="p-5 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#D7E7F5]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2742]">
                MODEL-DERIVED RISK GUIDANCE
              </span>
            </div>
            <span className="text-[10px] font-mono-stat font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#1557B0]">
              Deterministic Rules
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#D7E7F5] shadow-2xs space-y-3">
            <div>
              <div className="text-[10px] font-bold text-[#5D7188] uppercase">Advisory Assessment</div>
              <div className="font-extrabold text-sm text-[#0F2742] mt-0.5">
                {advisory?.primaryRiskReason || 'Conditions favorable for normal daily operations.'}
              </div>
            </div>

            {advisory?.detailedReasons && advisory.detailedReasons.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-[#5D7188] uppercase block">Risk Factors</span>
                <ul className="text-xs text-[#5D7188] space-y-1 list-disc list-inside">
                  {advisory.detailedReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {advisory?.rulesFired && advisory.rulesFired.length > 0 && (
              <div className="pt-2 border-t border-[#D7E7F5] flex flex-wrap gap-1.5">
                <span className="text-[10px] text-[#5D7188] font-mono-stat block w-full">Rules Evaluated:</span>
                {advisory.rulesFired.map((rule, idx) => (
                  <span key={idx} className="text-[10px] font-mono-stat px-2 py-0.5 rounded-md bg-[#F5FAFF] border border-[#D7E7F5] text-[#1557B0]">
                    {rule}
                  </span>
                ))}
              </div>
            )}

            {indicators.length > 0 && (
              <div className="pt-2 border-t border-[#D7E7F5] space-y-1">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Extreme Weather Indicator:</span>
                <div className="text-xs text-amber-900 font-medium">
                  {indicators.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
