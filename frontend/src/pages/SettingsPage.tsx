import React from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { Settings, Thermometer, Languages, Radio, Sparkles } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { preferences, setTempUnit, setWindUnit, setLanguage, toggleDemoMode, setSmsAlerts } = useWeatherStore();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-[#D7E7F5] shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F2742] flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-[#3B82F6]" />
          Platform Preferences & System Configuration
        </h1>
        <p className="text-xs text-[#5D7188] mt-1 leading-relaxed">
          Configure meteorological units, localized interface language, emergency push alerts, and sandbox sample modes.
        </p>
      </div>

      {/* Units & Measurement */}
      <div className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#0F2742] border-b border-[#D7E7F5] pb-3 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-[#3B82F6]" /> Meteorological Units of Measure
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3.5 bg-[#F5FAFF] rounded-xl border border-[#D7E7F5]">
            <span className="font-medium text-[#0F2742]">Temperature Scale</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#D7E7F5]">
              <button
                onClick={() => setTempUnit('°C')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  preferences.tempUnit === '°C' ? 'bg-[#1557B0] text-white shadow-2xs' : 'text-[#5D7188] hover:text-[#0F2742]'
                }`}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('°F')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  preferences.tempUnit === '°F' ? 'bg-[#1557B0] text-white shadow-2xs' : 'text-[#5D7188] hover:text-[#0F2742]'
                }`}
              >
                °F
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#F5FAFF] rounded-xl border border-[#D7E7F5]">
            <span className="font-medium text-[#0F2742]">Wind Velocity Scale</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#D7E7F5]">
              <button
                onClick={() => setWindUnit('km/h')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  preferences.windUnit === 'km/h' ? 'bg-[#1557B0] text-white shadow-2xs' : 'text-[#5D7188] hover:text-[#0F2742]'
                }`}
              >
                km/h
              </button>
              <button
                onClick={() => setWindUnit('m/s')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  preferences.windUnit === 'm/s' ? 'bg-[#1557B0] text-white shadow-2xs' : 'text-[#5D7188] hover:text-[#0F2742]'
                }`}
              >
                m/s
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#0F2742] border-b border-[#D7E7F5] pb-3 flex items-center gap-2">
          <Languages className="w-4 h-4 text-[#3B82F6]" /> Multilingual Localization & Dialect
        </h3>

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'हिन्दी (Hindi)' },
            { id: 'mr', label: 'मराठी (Marathi)' },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${
                preferences.language === l.id
                  ? 'bg-[#1557B0] text-white border-[#1557B0] shadow-2xs'
                  : 'bg-[#F5FAFF] text-[#0F2742] border-[#D7E7F5] hover:bg-[#DCEEFF]/40'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Notifications & SMS Fallback */}
      <div className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#0F2742] border-b border-[#D7E7F5] pb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-600" /> Emergency Alert Delivery Preferences
        </h3>

        <div className="flex items-center justify-between p-4 bg-[#F5FAFF] rounded-xl border border-[#D7E7F5] text-xs">
          <div>
            <span className="font-bold text-[#0F2742] block">SMS Fallback for Critical Alerts</span>
            <span className="text-[#5D7188] text-[11px] mt-0.5 block">
              If active data connectivity drops, critical red alerts are dispatched through SMS telemetry when configured on server.
            </span>
          </div>
          <button
            onClick={() => setSmsAlerts(!preferences.smsAlertsEnabled)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              preferences.smsAlertsEnabled ? 'bg-[#1557B0]' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                preferences.smsAlertsEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sample demo data */}
      <div className="card-3d bg-white border border-[#D7E7F5] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#0F2742] border-b border-[#D7E7F5] pb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" /> Demonstration Sandbox Dataset
        </h3>

        <div className="flex items-center justify-between p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
          <div>
            <span className="font-bold text-amber-900 block">
              Pre-bundled Mock Bundle {preferences.demoMode ? '(currently ENABLED)' : '(currently OFF)'}
            </span>
            <span className="text-amber-800 text-[11px] block mt-0.5 leading-relaxed">
              Disabled by default. When toggled, the application uses local synthetic data for demonstration without an active backend.
              Normal operation is connected directly to the real MeteoFusion backend.
            </span>
          </div>
          <button
            onClick={toggleDemoMode}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition-all shrink-0 ml-4 shadow-2xs ${
              preferences.demoMode
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {preferences.demoMode ? 'SAMPLE DATA ON' : 'LIVE (DEFAULT)'}
          </button>
        </div>
      </div>
    </div>
  );
};
