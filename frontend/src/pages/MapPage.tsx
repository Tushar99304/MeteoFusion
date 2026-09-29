import React from 'react';
import { WeatherMap } from '../components/map/WeatherMap';
import { Map } from 'lucide-react';

export const MapPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#17352A] flex items-center gap-2">
            <Map className="w-5 h-5 text-[#2E7D5B]" />
            Live Geospatial Weather Map
          </h1>
          <p className="text-xs text-[#6B7D74]">
            Current conditions across major Indian cities (Open-Meteo, research/repro) and official
            NDMA/SACHET alert locations. Radar/satellite tiles are not wired in this build.
          </p>
        </div>
      </div>

      <WeatherMap />
    </div>
  );
};
