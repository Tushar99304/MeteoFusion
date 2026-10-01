import React from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { DashboardForecastTimeline } from '../components/dashboard/DashboardForecastTimeline';
import { HourlyForecastScroll } from '../components/dashboard/HourlyForecastScroll';
import { DailyForecastList } from '../components/dashboard/DailyForecastList';
import { Calendar, Info, MapPin } from 'lucide-react';

export const ForecastPage: React.FC = () => {
  const { currentLocation, usingSample } = useWeatherStore();

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <Calendar className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <span className="text-[10px] font-bold text-[#1557B0] uppercase tracking-wider bg-[#EBF5FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
              High-Resolution NWP Sequence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2742] tracking-tight">
            Weather Forecast Center — {currentLocation.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#5D7188] mt-1 font-medium">
            Multi-model trajectory, hourly sequence, and 7-day extended meteorological outlook
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5FAFF] border border-[#D7E7F5] text-xs font-mono-stat text-[#0F2742]">
            <MapPin className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>{currentLocation.lat.toFixed(2)}°N, {currentLocation.lng.toFixed(2)}°E</span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
            usingSample 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {usingSample ? 'Sample Demo Feed' : 'Open-Meteo · Live Ingestion'}
          </div>
        </div>
      </div>

      {/* 1. Interactive Timeline Charts (Temperature, Rain, Wind) */}
      <DashboardForecastTimeline />

      {/* 2. Hourly Horizontal Step Strip */}
      <HourlyForecastScroll />

      {/* 3. Daily Outlook List */}
      <DailyForecastList />

      {/* 4. Meteorological Disclosure Card */}
      <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-6 shadow-xs space-y-2 text-xs text-[#5D7188]">
        <div className="font-extrabold text-[#0F2742] text-sm flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#3B82F6]" /> Upstream Meteorological Attribution & Grounding
        </div>
        <p className="leading-relaxed">
          Forecast trajectories are ingested from Open-Meteo research datasets and ECMWF/GFS global models.
          When official NDMA SACHET civil protection disaster warnings are active for this geographic coordinate,
          they supersede model forecast outputs and are surfaced prominently with authoritative instructions.
        </p>
      </div>
    </div>
  );
};
