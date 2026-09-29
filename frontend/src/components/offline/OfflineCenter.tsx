import React, { useState } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { 
  WifiOff, 
  HardDrive, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock
} from 'lucide-react';
import { formatTemp } from '../../utils/formatters';

export const OfflineCenter: React.FC = () => {
  const { currentWeather, connection, preferences } = useWeatherStore();
  const [openSection, setOpenSection] = useState<string | null>('flood');

  const emergencyGuides = [
    {
      id: 'flood',
      title: 'Monsoon Flood & Waterlogging Protocol',
      icon: '🌊',
      steps: [
        'Disconnect electrical appliances if water reaches house threshold.',
        'Avoid driving through flooded underpasses (Hindmata, Sion, Kurla).',
        'Store 3 days of potable drinking water and essential medicines.',
        'Contact Disaster Management Cell: Dial 1916 (BMC) / 112 (State Emergency).',
      ],
    },
    {
      id: 'cyclone',
      title: 'Coastal Cyclone & Gusty Wind Protocol',
      icon: '🌀',
      steps: [
        'Secure doors, window shutters, and unanchored rooftop solar panels.',
        'Stay away from tall trees, old building parapets, and electrical pylons.',
        'Do not venture near beaches or coastal promenades during high tide warnings.',
      ],
    },
    {
      id: 'heatwave',
      title: 'Severe Heatwave Advisory',
      icon: '☀️',
      steps: [
        'Drink ORS, buttermilk, or lemon water regularly even if not thirsty.',
        'Cover head with wet cloth or hat when stepping outdoors between 12 PM - 3 PM.',
        'Watch for signs of heat exhaustion: dizziness, rapid pulse, dark urine.',
      ],
    },
    {
      id: 'thunderstorm',
      title: 'Thunderstorm & Severe Lightning Advisory',
      icon: '⚡',
      steps: [
        'Seek shelter in sturdy concrete building or enclosed hard-top vehicle.',
        'Do not shelter under tall solitary trees or metal poles in open fields.',
        'Unplug sensitive electronics and avoid using corded phones during strike spells.',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 text-amber-900 rounded-xl">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-base text-[#17352A]">Offline Meteorological Center</h2>
            <p className="text-xs text-[#6B7D74]">
              {connection.isOnline
                ? 'Online Mode — Cached copies saved automatically for offline access.'
                : `Offline Mode Active — last synchronized ${connection.lastSyncedAt ? 'at ' + connection.lastSyncedAt : 'time unknown'}`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold border border-amber-300">
            {connection.isOnline ? 'CACHE SYNCED' : 'OFFLINE ACTIVE'}
          </span>
        </div>
      </div>

      {/* Cached Weather Overview */}
      {currentWeather && (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#2E7D5B]" />
              <h3 className="font-bold text-sm text-[#17352A]">Last Synchronized Weather Snapshot</h3>
            </div>
            <span className="text-xs text-[#6B7D74] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Synced: {currentWeather.observedAt}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2]">
              <span className="text-[#6B7D74]">Location</span>
              <div className="font-bold text-[#17352A] mt-0.5">{currentWeather.location}</div>
            </div>
            <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2]">
              <span className="text-[#6B7D74]">Temperature</span>
              <div className="font-bold text-[#17352A] mt-0.5">
                {currentWeather.temperature != null
                  ? formatTemp(currentWeather.temperature, preferences.tempUnit)
                  : '—'}
              </div>
            </div>
            <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2]">
              <span className="text-[#6B7D74]">Precipitation</span>
              <div className="font-bold text-[#17352A] mt-0.5">
                {currentWeather.rainfall != null ? `${currentWeather.rainfall} mm` : '—'}
                {currentWeather.rainProbability != null ? ` (${currentWeather.rainProbability}%)` : ''}
              </div>
            </div>
            <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2]">
              <span className="text-[#6B7D74]">Source</span>
              <div className="font-bold text-[#2E7D5B] mt-0.5">{currentWeather.source}</div>
            </div>
          </div>

          {!connection.isOnline && (
            <div className="bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Live updates are unavailable. Showing the last cached grounded evidence — not fresh
                observations and not official IMD data. Follow current official advisories directly.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Emergency Guidance Protocols */}
      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="border-b border-[#DCEAE2] pb-3">
          <h3 className="font-bold text-base text-[#17352A]">Offline Emergency Disaster Protocols</h3>
          <p className="text-xs text-[#6B7D74]">NDMA SACHET verified actionable guidance accessible without internet connection</p>
        </div>

        <div className="space-y-3">
          {emergencyGuides.map((guide) => {
            const isOpen = openSection === guide.id;
            return (
              <div
                key={guide.id}
                className="border border-[#DCEAE2] rounded-xl overflow-hidden bg-[#F7FBF8]"
              >
                <button
                  onClick={() => setOpenSection(isOpen ? null : guide.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#E8F5EE] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{guide.icon}</span>
                    <span className="font-bold text-sm text-[#17352A]">{guide.title}</span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-[#6B7D74]" /> : <ChevronDown className="w-4 h-4 text-[#6B7D74]" />}
                </button>

                {isOpen && (
                  <div className="p-4 bg-white border-t border-[#DCEAE2] space-y-2 text-xs">
                    {guide.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[#17352A]">
                        <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
