import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { FlaskConical, Radio } from 'lucide-react';

/**
 * Toggles between LIVE (real backend) and explicit SAMPLE demo data. Live is the default;
 * sample content is always visibly badged so it is never mistaken for a real/official feed.
 */
export const DemoModeBadge: React.FC = () => {
  const { preferences, toggleDemoMode } = useWeatherStore();
  const demo = preferences.demoMode;

  return (
    <button
      onClick={toggleDemoMode}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
        demo
          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
          : 'bg-[#E8F5EE] text-[#2E7D5B] border-[#6BAF92]/40 hover:bg-[#2E7D5B] hover:text-white'
      }`}
      title={
        demo
          ? 'Showing bundled SAMPLE demo data — click to use the live WeatherGPT backend'
          : 'Live backend evidence — click to switch to labelled sample demo data'
      }
    >
      {demo ? <FlaskConical className="w-3.5 h-3.5 text-amber-600" /> : <Radio className="w-3.5 h-3.5" />}
      <span>{demo ? 'SAMPLE DATA' : 'LIVE BACKEND'}</span>
    </button>
  );
};
