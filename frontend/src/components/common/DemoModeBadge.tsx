import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { FlaskConical } from 'lucide-react';

/**
 * Toggles between LIVE mode (real backend and NWP models) and explicit SAMPLE demo data.
 * When demo mode is off, displays a neutral Demo Mode toggle button so it never clashes
 * with the live weather freshness badges or falsely claims to be a feed.
 */
export const DemoModeBadge: React.FC = () => {
  const { preferences, toggleDemoMode } = useWeatherStore();
  const demo = preferences.demoMode;

  return (
    <button
      onClick={toggleDemoMode}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-xs ${
        demo
          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
          : 'bg-[#F5FAFF] text-[#5D7188] border-[#D7E7F5] hover:bg-[#DCEEFF] hover:text-[#1557B0]'
      }`}
      title={
        demo
          ? 'Showing bundled SAMPLE demo data — click to return to live MeteoFusion backend'
          : 'Click to test with bundled sample demo data'
      }
    >
      <FlaskConical className={`w-3.5 h-3.5 ${demo ? 'text-amber-700' : 'text-[#5D7188]'}`} />
      <span>{demo ? 'DEMO DATA ACTIVE' : 'DEMO MODE'}</span>
    </button>
  );
};
