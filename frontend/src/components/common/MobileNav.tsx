import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays,
  Map, 
  MessageSquareText,
  Menu
} from 'lucide-react';
import { useWeatherStore } from '../../store/useWeatherStore';

export const MobileNav: React.FC = () => {
  const { setMobileSidePanelOpen, isMobileSidePanelOpen, alerts } = useWeatherStore();
  const warningCount = alerts.filter(a => a.validity === 'active').length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-md border-t border-[#D7E7F5] flex items-center justify-around z-40 lg:hidden shadow-lg px-1 select-none">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] px-1 py-1 rounded-xl text-[10px] font-semibold transition-colors touch-manipulation ${
            isActive ? 'text-[#1557B0] font-bold' : 'text-[#5D7188] hover:text-[#0F2742]'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5 shrink-0" />
        <span>Overview</span>
      </NavLink>

      <NavLink
        to="/forecast"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] px-1 py-1 rounded-xl text-[10px] font-semibold transition-colors touch-manipulation ${
            isActive ? 'text-[#1557B0] font-bold' : 'text-[#5D7188] hover:text-[#0F2742]'
          }`
        }
      >
        <CalendarDays className="w-5 h-5 shrink-0" />
        <span>Forecast</span>
      </NavLink>

      {/* Center Floating Chat/Voice Button */}
      <NavLink
        to="/chat"
        className="w-13 h-13 rounded-full bg-gradient-to-br from-[#1557B0] to-[#3B82F6] text-white flex items-center justify-center -mt-7 shadow-lg shadow-blue-500/30 border-4 border-white active:scale-95 transition-transform touch-manipulation shrink-0"
        title="AI Weather Assistant"
        aria-label="AI Weather Assistant Chat"
      >
        <MessageSquareText className="w-5 h-5 text-white" />
      </NavLink>

      <NavLink
        to="/map"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] px-1 py-1 rounded-xl text-[10px] font-semibold transition-colors touch-manipulation ${
            isActive ? 'text-[#1557B0] font-bold' : 'text-[#5D7188] hover:text-[#0F2742]'
          }`
        }
      >
        <Map className="w-5 h-5 shrink-0" />
        <span>Map</span>
      </NavLink>

      {/* Mobile Side Panel Trigger (Chat History & All Features) */}
      <button
        onClick={() => setMobileSidePanelOpen(!isMobileSidePanelOpen)}
        className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] px-1 py-1 rounded-xl text-[10px] font-semibold transition-colors touch-manipulation ${
          isMobileSidePanelOpen ? 'text-[#1557B0] font-bold' : 'text-[#5D7188] hover:text-[#0F2742]'
        }`}
        title="Open Chat History & More Features"
        aria-label="Open mobile side panel"
      >
        <Menu className="w-5 h-5 shrink-0" />
        <span>More</span>
        {warningCount > 0 && (
          <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
        )}
      </button>
    </nav>
  );
};
