import React, { useEffect, useState } from 'react';
import { useWeatherStore } from '../store/useWeatherStore';
import { AdvisoryCard } from '../components/advisory/AdvisoryCard';
import type { ActivityCategory, WeatherAdvisory } from '../types';
import { getAdvisoryForActivity } from '../services/advisoryService';
import { Compass, Loader2, Info } from 'lucide-react';

export const AdvisoryPage: React.FC = () => {
  const { selectedActivity, setSelectedActivity, currentLocation, preferences } = useWeatherStore();
  const [advisory, setAdvisory] = useState<WeatherAdvisory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#17352A] flex items-center gap-2">
          <Compass className="w-6 h-6 text-[#2E7D5B]" />
          Weather Decision Support & Sector Advisory
        </h1>
        <p className="text-xs text-[#6B7D74]">
          Deterministic, evidence-based weather risk from the backend — computed from validated
          evidence and official alerts, never from an LLM. Official alerts always take precedence.
        </p>
      </div>

      <div className="bg-[#F7FBF8] border border-[#DCEAE2] rounded-2xl p-4 text-xs text-[#6B7D74] flex items-start gap-2">
        <Info className="w-4 h-4 text-[#2E7D5B] shrink-0 mt-0.5" />
        <span>
          The activity you choose is passed to the backend advisory engine. It does not change the
          underlying evidence, thresholds or risk level — it frames the same deterministic estimate
          for your context. This is weather-related risk guidance, not a safety guarantee or an
          official order.
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedActivity(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              selectedActivity === cat.id
                ? 'bg-[#2E7D5B] text-white border-[#2E7D5B] shadow-xs'
                : 'bg-white text-[#17352A] border-[#DCEAE2] hover:bg-[#E8F5EE]'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-8 text-center text-sm text-[#6B7D74] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#2E7D5B]" />
          Computing the deterministic advisory…
        </div>
      ) : advisory ? (
        <AdvisoryCard advisory={{ ...advisory, location: currentLocation.name }} isSample={isSample} />
      ) : (
        <div className="bg-white border border-[#DCEAE2] rounded-2xl p-8 text-center text-xs text-[#6B7D74]">
          No advisory could be produced from verified evidence.
        </div>
      )}
    </div>
  );
};
