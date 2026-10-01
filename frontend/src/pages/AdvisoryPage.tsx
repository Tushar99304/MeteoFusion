import React, { useEffect, useState } from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { AdvisoryCard } from '../components/advisory/AdvisoryCard';
import type { ActivityCategory, WeatherAdvisory } from '../types';
import { getAdvisoryForActivity } from '../services/advisoryService';
import { Compass, Loader2, Info } from 'lucide-react';

export const AdvisoryPage: React.FC = () => {
  const { selectedActivity, setSelectedActivity, currentLocation, preferences } = useWeatherStore();
  const [advisory, setAdvisory] = useState<WeatherAdvisory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSample, setIsSample] = useState(false);

  const categories: { id: ActivityCategory; label: string; icon: string }[] = [
    { id: 'Driving', label: 'Expressway Driving', icon: '🚗' },
    { id: 'Travel', label: 'Public Transit & Rail', icon: '🚆' },
    { id: 'Outdoor Event', label: 'Outdoor Events', icon: '🎪' },
    { id: 'Trekking', label: 'Hills & Trekking', icon: '🏔️' },
    { id: 'Agriculture', label: 'Agro Advisory', icon: '🌾' },
    { id: 'Marine', label: 'Marine & Fishing', icon: '⚓' },
    { id: 'Daily Activity', label: 'Daily Outings', icon: '🚶' },
  ];

  useEffect(() => {
    let cancelled = false;
    const hint = `${currentLocation.name}, ${currentLocation.state}`;
    getAdvisoryForActivity(selectedActivity, hint, preferences.demoMode)
      .then(({ advisory: adv, isSample: sample }) => {
        if (cancelled) return;
        setAdvisory(adv);
        setIsSample(sample);
      })
      .catch(() => {
        if (cancelled) return;
        setAdvisory(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedActivity, currentLocation, preferences.demoMode]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="card-3d bg-white p-6 sm:p-8 rounded-3xl border border-[#D7E7F5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#DCEEFF] text-[#1557B0]">
              <Compass className="w-5 h-5 text-[#3B82F6]" />
            </span>
            <span className="text-[10px] font-bold text-[#1557B0] uppercase tracking-wider bg-[#EBF5FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
              Deterministic Sector Analysis
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2742] tracking-tight">
            Weather Decision Support & Sector Advisory
          </h1>
          <p className="text-xs sm:text-sm text-[#5D7188] mt-1 font-medium">
            Deterministic, rule-verified risk assessment evaluated from validated evidence and official disaster alerts.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[#EBF5FF] border border-[#BFDBFE] text-xs text-[#1557B0] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          The selected sector frames the deterministic thresholds for your context. It does not alter the underlying weather evidence. Official NDMA SACHET disaster alerts always supersede sector heuristics.
        </span>
      </div>

      {/* Sector Category Pills */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedActivity(cat.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 shadow-2xs ${
              selectedActivity === cat.id
                ? 'bg-[#1557B0] text-white border-[#1557B0] shadow-sm'
                : 'bg-white text-[#0F2742] border-[#D7E7F5] hover:bg-[#F5FAFF]'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-16 text-center text-xs text-[#5D7188] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
          <span className="font-bold text-[#0F2742]">Evaluating Deterministic Advisory Rules…</span>
        </div>
      ) : advisory ? (
        <AdvisoryCard advisory={{ ...advisory, location: currentLocation.name }} isSample={isSample} />
      ) : (
        <div className="card-3d bg-white border border-[#D7E7F5] rounded-3xl p-12 text-center text-xs text-[#5D7188]">
          No advisory could be produced from current verified meteorological evidence.
        </div>
      )}
    </div>
  );
};
