import React from 'react';
import { LocationSelector } from './LocationSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { DemoModeBadge } from './DemoModeBadge';
import { CloudSun, Bell, Settings, Languages, ShieldAlert, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWeatherStore } from '../../store/useWeatherStore';

export const Header: React.FC = () => {
  const { alerts, setActiveAlertModal, preferences, setLanguage, setMobileSidePanelOpen } = useWeatherStore();
  const warningCount = alerts.filter(a => a.validity === 'active').length;

  const nextLanguage = () => {
    if (preferences.language === 'en') setLanguage('hi');
    else if (preferences.language === 'hi') setLanguage('mr');
    else setLanguage('en');
  };

  const langLabel = {
    en: 'EN',
    hi: 'हिन्दी',
    mr: 'मराठी',
  }[preferences.language] || 'EN';

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#D7E7F5] px-3 sm:px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-2">
      {/* Brand Title (Mobile / Tablet) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile Menu Drawer Toggle Button */}
        <button
          onClick={() => setMobileSidePanelOpen(true)}
          className="lg:hidden p-2 rounded-xl border border-[#D7E7F5] bg-white hover:bg-[#DCEEFF] text-[#0F2742] transition-colors touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0 shadow-2xs"
          title="Open Menu & Chat History"
          aria-label="Open mobile menu drawer"
        >
          <Menu className="w-4 h-4 text-[#1557B0]" />
        </button>

        <Link to="/" className="flex items-center gap-2 lg:hidden shrink-0" aria-label="MeteoFusion Home">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1557B0] to-[#3B82F6] flex items-center justify-center text-white shadow-xs shrink-0">
            <CloudSun className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base text-[#0F2742] leading-tight block">MeteoFusion</span>
            <span className="hidden sm:block text-[10px] text-[#5D7188] font-medium tracking-tight">AI × NWP Blending</span>
          </div>
        </Link>
        <div className="hidden lg:block">
          <LocationSelector />
        </div>
      </div>

      {/* Center Location (Mobile/Tablet) */}
      <div className="lg:hidden flex-1 max-w-[140px] xs:max-w-[190px] sm:max-w-xs min-w-0 mx-auto">
        <LocationSelector />
      </div>

      <div className="hidden lg:flex items-center gap-3">
        <ConnectionStatus />
        <DemoModeBadge />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Language selector toggle */}
        <button
          onClick={nextLanguage}
          className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#D7E7F5] bg-[#F5FAFF] hover:bg-[#DCEEFF] text-[#0F2742] text-xs font-semibold transition-all shadow-2xs touch-manipulation min-h-[36px]"
          title={`Language: ${langLabel}. Click to switch.`}
          aria-label="Toggle language"
        >
          <Languages className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>{langLabel}</span>
        </button>

        {/* Notifications / Alerts button */}
        <button
          onClick={() => {
            if (alerts.length > 0) setActiveAlertModal(alerts[0]);
          }}
          className={`relative p-2 rounded-xl border transition-all touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center ${
            warningCount > 0
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              : 'border-[#D7E7F5] text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742]'
          }`}
          title={warningCount > 0 ? `${warningCount} Official SACHET alert active` : 'No active disaster alerts'}
          aria-label="View official alerts"
        >
          {warningCount > 0 ? <ShieldAlert className="w-4 h-4 text-rose-600" /> : <Bell className="w-4 h-4 text-[#5D7188]" />}
          {warningCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-4 px-1 bg-rose-600 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center animate-pulse shadow-xs">
              {warningCount}
            </span>
          )}
        </button>

        {/* Settings button */}
        <Link
          to="/settings"
          className="p-2 rounded-xl border border-[#D7E7F5] text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742] transition-colors touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
          title="Platform Settings & Preferences"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
};
