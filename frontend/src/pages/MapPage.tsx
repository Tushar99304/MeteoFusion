import React from 'react';
import { WeatherMap } from '../components/map/WeatherMap';
import { Compass } from 'lucide-react';

export const MapPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <Compass className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <span className="text-[10px] font-bold text-[#1557B0] uppercase tracking-wider bg-[#EBF5FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
              Geospatial Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2742] tracking-tight">
            SPATIAL WEATHER INTELLIGENCE
          </h1>
          <p className="text-xs sm:text-sm text-[#5D7188] mt-1 font-medium">
            Live observation anchors, official alert coverage, and click-to-pinpoint telemetry for any city, village, or terrain coordinate
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Click Anywhere to Pin</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[#F5FAFF] border border-[#D7E7F5] text-xs font-mono-stat text-[#1557B0]">
            Pan-India Meteorological Grid
          </span>
        </div>
      </div>

      {/* Interactive Map */}
      <WeatherMap />
    </div>
  );
};
