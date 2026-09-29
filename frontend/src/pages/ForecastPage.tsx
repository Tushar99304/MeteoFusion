import React from 'react';
import { HourlyForecastScroll } from '../components/dashboard/HourlyForecastScroll';
import { DailyForecastList } from '../components/dashboard/DailyForecastList';
import { useWeatherStore } from '../store/useWeatherStore';
import { Calendar, Info } from 'lucide-react';

export const ForecastPage: React.FC = () => {
  const { currentLocation, usingSample } = useWeatherStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#2E7D5B]" />
            Weather Forecast Center — {currentLocation.name}
          </h1>
          <p className="text-xs text-[#6B7D74]">
            Next-24-hour trend and daily forecast from the configured weather provider
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
          {usingSample ? 'Sample demo data' : 'Open-Meteo · research/repro'}
        </div>
      </div>

      <HourlyForecastScroll />
      <DailyForecastList />

      <div className="bg-white border border-[#DCEAE2] rounded-2xl p-5 shadow-xs space-y-2 text-xs text-[#6B7D74]">
        <div className="font-bold text-[#17352A] flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#2E7D5B]" /> Forecast source policy
        </div>
        <p className="leading-relaxed">
          This build retrieves model forecast data from Open-Meteo (research/reproducibility).
          Official NDMA/SACHET disaster alerts — when active for this location — always take
          precedence over this model forecast and are shown first. No IMD live feed is wired in
          yet, so nothing here is presented as an official IMD forecast.
        </p>
      </div>
    </div>
  );
};
