import React from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { Settings, Thermometer, Languages, Radio, Sparkles } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { preferences, setTempUnit, setWindUnit, setLanguage, toggleDemoMode, setSmsAlerts } = useWeatherStore();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#2E7D5B]" />
          Application Preferences & System Configuration
        </h1>
        <p className="text-xs text-[#6B7D74]">
          Customize units, language, notification preferences, offline cache and demo mode
        </p>
      </div>

      {/* Units & Measurement */}
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#17352A] border-b border-[#DCEAE2] pb-2 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-[#2E7D5B]" /> Measurement Units
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="font-medium text-[#17352A]">Temperature Unit</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#DCEAE2]">
              <button
                onClick={() => setTempUnit('°C')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  preferences.tempUnit === '°C' ? 'bg-[#2E7D5B] text-white' : 'text-[#6B7D74]'
                }`}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('°F')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  preferences.tempUnit === '°F' ? 'bg-[#2E7D5B] text-white' : 'text-[#6B7D74]'
                }`}
              >
                °F
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2]">
            <span className="font-medium text-[#17352A]">Wind Speed Unit</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#DCEAE2]">
              <button
                onClick={() => setWindUnit('km/h')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  preferences.windUnit === 'km/h' ? 'bg-[#2E7D5B] text-white' : 'text-[#6B7D74]'
                }`}
              >
                km/h
              </button>
              <button
                onClick={() => setWindUnit('m/s')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  preferences.windUnit === 'm/s' ? 'bg-[#2E7D5B] text-white' : 'text-[#6B7D74]'
                }`}
              >
                m/s
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#17352A] border-b border-[#DCEAE2] pb-2 flex items-center gap-2">
          <Languages className="w-4 h-4 text-[#2E7D5B]" /> Multilingual UI & Voice Interface
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
              className={`px-4 py-2 rounded-xl font-bold border transition-colors ${
                preferences.language === l.id
                  ? 'bg-[#2E7D5B] text-white border-[#2E7D5B]'
                  : 'bg-[#F7FBF8] text-[#17352A] border-[#DCEAE2] hover:bg-[#E8F5EE]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Notifications & SMS Fallback */}
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#17352A] border-b border-[#DCEAE2] pb-2 flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-600" /> Emergency Alert Delivery Preferences
        </h3>

        <div className="flex items-center justify-between p-4 bg-[#F7FBF8] rounded-xl border border-[#DCEAE2] text-xs">
          <div>
            <span className="font-bold text-[#17352A] block">SMS Fallback for Critical Alerts</span>
            <span className="text-[#6B7D74] text-[11px]">
              If internet connectivity is unavailable, critical alerts may be delivered through SMS when configured on backend server.
            </span>
          </div>
          <button
            onClick={() => setSmsAlerts(!preferences.smsAlertsEnabled)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              preferences.smsAlertsEnabled ? 'bg-[#2E7D5B]' : 'bg-gray-300'
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

      {/* Sample demo data (default OFF; the real backend is the default) */}
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#17352A] border-b border-[#DCEAE2] pb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" /> Sample demo data
        </h3>

        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs">
          <div>
            <span className="font-bold text-amber-900 block">
              Bundled SAMPLE dataset {preferences.demoMode ? '(currently ENABLED)' : '(currently OFF)'}
            </span>
            <span className="text-amber-800 text-[11px] block mt-0.5">
              OFF by default. When enabled, the app shows clearly-labelled fabricated sample data
              for walkthroughs without a backend — it is never official or live data. Normal use
              talks to the real WeatherGPT backend.
            </span>
          </div>
          <button
            onClick={toggleDemoMode}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors shrink-0 ml-3 ${
              preferences.demoMode
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            {preferences.demoMode ? 'SAMPLE DATA ON' : 'LIVE (DEFAULT)'}
          </button>
        </div>
      </div>
    </div>
  );
};
