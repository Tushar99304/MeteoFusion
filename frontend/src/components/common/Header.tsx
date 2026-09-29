import React from 'react';
import { LocationSelector } from './LocationSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { DemoModeBadge } from './DemoModeBadge';
import { CloudSun, Bell, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWeatherStore } from '../../store/useWeatherStore';

export const Header: React.FC = () => {
  const { alerts, setActiveAlertModal } = useWeatherStore();
  const warningCount = alerts.length;

  return (
    <header className="h-16 bg-white border-b border-[#DCEAE2] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Mobile / Desktop Brand Title */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E7D5B] to-[#6BAF92] flex items-center justify-center text-white shadow-xs">
            <CloudSun className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-[#17352A] leading-tight block">WeatherGPT</span>
            <span className="text-[10px] text-[#6B7D74] hidden sm:block">Trusted Weather Intelligence</span>
          </div>
        </Link>
      </div>

      {/* Center Location & Connection Info */}
      <div className="flex items-center gap-3">
        <LocationSelector />
        <div className="hidden md:flex items-center gap-2">
          <ConnectionStatus />
          <DemoModeBadge />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveAlertModal(alerts[0] || null)}
          className="relative p-2 rounded-lg text-[#17352A] hover:bg-[#E8F5EE] transition-colors"
          title="Official Weather Notifications"
        >
          <Bell className="w-5 h-5 text-[#2E7D5B]" />
          {warningCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
              {warningCount}
            </span>
          )}
        </button>

        <Link
          to="/settings"
          className="p-2 rounded-lg text-[#17352A] hover:bg-[#E8F5EE] transition-colors"
          title="Application Settings"
        >
          <Settings className="w-5 h-5 text-[#2E7D5B]" />
        </Link>
      </div>
    </header>
  );
};
