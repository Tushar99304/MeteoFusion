import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  CalendarDays, 
  Map, 
  AlertTriangle, 
  LineChart, 
  Compass, 
  Mic, 
  WifiOff, 
  Settings, 
  Database,
  CloudSun
} from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/chat', label: 'WeatherGPT Chat', icon: MessageSquareText },
    { to: '/forecast', label: 'Forecast', icon: CalendarDays },
    { to: '/map', label: 'Live Map', icon: Map },
    { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { to: '/climate', label: 'Climate', icon: LineChart },
    { to: '/advisory', label: 'Advisory', icon: Compass },
  ];

  const secondaryItems = [
    { to: '/voice', label: 'Voice Assistant', icon: Mic },
    { to: '/offline', label: 'Offline Center', icon: WifiOff },
  ];

  const footerItems = [
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/sources', label: 'Trusted Sources', icon: Database },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#DCEAE2] flex flex-col justify-between hidden lg:flex h-screen sticky top-0 z-40">
      <div className="p-4 overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E7D5B] to-[#6BAF92] flex items-center justify-center text-white shadow-xs">
            <CloudSun className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-[#17352A] text-lg leading-tight">WeatherGPT</h1>
            <p className="text-[11px] text-[#6B7D74]">SIH 2026 Prototype</p>
          </div>
        </div>

        {/* Navigation Group 1 */}
        <div className="space-y-1 mb-4">
          <div className="text-[11px] font-semibold text-[#6B7D74] uppercase tracking-wider px-3 mb-2">Core Features</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#E8F5EE] text-[#2E7D5B] font-semibold shadow-2xs'
                      : 'text-[#6B7D74] hover:bg-[#F7FBF8] hover:text-[#17352A]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <hr className="border-[#DCEAE2] my-3" />

        {/* Navigation Group 2 */}
        <div className="space-y-1 mb-4">
          <div className="text-[11px] font-semibold text-[#6B7D74] uppercase tracking-wider px-3 mb-2">Intelligence & Offline</div>
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#E8F5EE] text-[#2E7D5B] font-semibold shadow-2xs'
                      : 'text-[#6B7D74] hover:bg-[#F7FBF8] hover:text-[#17352A]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <hr className="border-[#DCEAE2] my-3" />

        {/* System Links */}
        <div className="space-y-1">
          {footerItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#E8F5EE] text-[#2E7D5B] font-semibold'
                      : 'text-[#6B7D74] hover:bg-[#F7FBF8] hover:text-[#17352A]'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer Connection Pill */}
      <div className="p-4 border-t border-[#DCEAE2] bg-[#F7FBF8]">
        <ConnectionStatus />
      </div>
    </aside>
  );
};
