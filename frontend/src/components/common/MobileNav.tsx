import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  Map, 
  AlertTriangle, 
  Mic 
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#DCEAE2] flex items-center justify-around z-40 lg:hidden shadow-lg px-2">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-[#2E7D5B] font-bold' : 'text-[#6B7D74]'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/chat"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-[#2E7D5B] font-bold' : 'text-[#6B7D74]'
          }`
        }
      >
        <MessageSquareText className="w-5 h-5" />
        <span>Chat</span>
      </NavLink>

      {/* Center Floating Mic Button */}
      <NavLink
        to="/voice"
        className="w-12 h-12 rounded-full bg-[#2E7D5B] text-white flex items-center justify-center -mt-6 shadow-lg border-4 border-white active:scale-95 transition-transform"
        title="Ask Voice Assistant"
      >
        <Mic className="w-6 h-6 animate-pulse" />
      </NavLink>

      <NavLink
        to="/map"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-[#2E7D5B] font-bold' : 'text-[#6B7D74]'
          }`
        }
      >
        <Map className="w-5 h-5" />
        <span>Map</span>
      </NavLink>

      <NavLink
        to="/alerts"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            isActive ? 'text-[#2E7D5B] font-bold' : 'text-[#6B7D74]'
          }`
        }
      >
        <AlertTriangle className="w-5 h-5" />
        <span>Alerts</span>
      </NavLink>
    </nav>
  );
};
