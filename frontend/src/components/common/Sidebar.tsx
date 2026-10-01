import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  CalendarDays, 
  Map, 
  AlertTriangle, 
  LineChart, 
  Compass, 
  Mic, 
  Settings, 
  Database,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const coreNav = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/forecast', label: 'Forecast', icon: CalendarDays },
    { to: '/#models', label: 'Model Intelligence', icon: Cpu, isHash: true },
    { to: '/#engine', label: 'Blending Engine', icon: Layers, isHash: true },
    { to: '/map', label: 'Weather Map', icon: Map },
    { to: '/alerts', label: 'Risk & Alerts', icon: AlertTriangle },
    { to: '/advisory', label: 'Sector Advisory', icon: Compass },
    { to: '/climate', label: 'Climate Trends', icon: LineChart },
  ];

  const assistantNav = [
    { to: '/chat', label: 'AI Assistant', icon: MessageSquareText },
    { to: '/voice', label: 'Voice Assistant', icon: Mic },
  ];

  const systemNav = [
    { to: '/sources', label: 'Sources & Evidence', icon: Database },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleHashClick = (hash: string) => {
    if (location.pathname !== '/') {
      navigate(`/${hash}`);
      return;
    }
    const elem = document.querySelector(hash);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside className="w-64 bg-white/90 backdrop-blur-md border-r border-[#D7E7F5] flex flex-col justify-between hidden lg:flex h-screen sticky top-0 z-40 shadow-xs">
      <div className="p-4 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-4 rounded-2xl bg-gradient-to-br from-[#F5FAFF] to-[#DCEEFF]/40 border border-[#D7E7F5]/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1557B0] to-[#3B82F6] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-[#0F2742] text-lg leading-tight tracking-tight">MeteoFusion</h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1557B0] text-white">AI</span>
            </div>
            <p className="text-[10px] text-[#5D7188] font-medium tracking-tight">AI × NWP Forecast Intelligence</p>
          </div>
        </div>

        {/* Section: Meteorological Intelligence */}
        <div className="space-y-1 mb-5">
          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-3 mb-1.5">
            Operations & Blending
          </div>
          {coreNav.map((item) => {
            const Icon = item.icon;
            if (item.isHash) {
              const hashId = item.to.replace('/', '');
              const isCurrentHash = location.pathname === '/' && location.hash === hashId;
              return (
                <button
                  key={item.to}
                  onClick={() => handleHashClick(hashId)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                    isCurrentHash
                      ? 'bg-[#DCEEFF] text-[#1557B0] shadow-xs'
                      : 'text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742]'
                  }`}
                >
                  {isCurrentHash && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#3B82F6] rounded-r-full shadow-sm" />
                  )}
                  <Icon className={`w-4 h-4 ${isCurrentHash ? 'text-[#3B82F6]' : 'text-[#5D7188]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                    isActive
                      ? 'bg-[#DCEEFF] text-[#1557B0] shadow-xs'
                      : 'text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#3B82F6] rounded-r-full shadow-sm" />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#3B82F6]' : 'text-[#5D7188]'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <hr className="border-[#D7E7F5] my-3" />

        {/* Section: Conversational & Voice AI */}
        <div className="space-y-1 mb-5">
          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-3 mb-1.5">
            Conversational Intelligence
          </div>
          {assistantNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                    isActive
                      ? 'bg-[#DCEEFF] text-[#1557B0] shadow-xs'
                      : 'text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#3B82F6] rounded-r-full shadow-sm" />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#3B82F6]' : 'text-[#5D7188]'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <hr className="border-[#D7E7F5] my-3" />

        {/* Section: Audit & Configuration */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-3 mb-1.5">
            Audit & System
          </div>
          {systemNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                    isActive
                      ? 'bg-[#DCEEFF] text-[#1557B0] shadow-xs'
                      : 'text-[#5D7188] hover:bg-[#F5FAFF] hover:text-[#0F2742]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#3B82F6] rounded-r-full shadow-sm" />
                    )}
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#3B82F6]' : 'text-[#5D7188]'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer System Telemetry */}
      <div className="p-3.5 border-t border-[#D7E7F5] bg-[#F5FAFF]/80 flex flex-col gap-2">
        <div className="text-[10px] text-[#5D7188] font-mono-stat flex items-center justify-between">
          <span>MoES SIH26081</span>
          <span className="font-semibold text-[#1557B0]">v0.5.0-AIFS</span>
        </div>
        <ConnectionStatus />
      </div>
    </aside>
  );
};
