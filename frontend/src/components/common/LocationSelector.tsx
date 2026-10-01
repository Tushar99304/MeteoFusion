import React, { useState, useRef, useEffect } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { searchLocations, getCurrentGeoLocation } from '../../services/locationService';
import { MapPin, Search, Navigation, Check, ChevronDown } from 'lucide-react';
import type { Location } from '../../types';

export const LocationSelector: React.FC = () => {
  const { currentLocation, setLocation, setGpsLocation } = useWeatherStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredLocations = searchLocations(query);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (loc: Location) => {
    setLocation(loc);
    setIsOpen(false);
    setQuery('');
  };

  const handleGPSLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getCurrentGeoLocation();
      setGpsLocation(loc.lat, loc.lng);
      setIsOpen(false);
    } catch {
      alert('Unable to detect GPS position. Please choose a city from the list.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-white border border-[#D7E7F5] text-[#0F2742] font-semibold text-xs sm:text-sm hover:border-[#3B82F6] hover:bg-[#F5FAFF] transition-all shadow-xs touch-manipulation"
        aria-label="Select location"
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6] shrink-0" />
          <span className="truncate">{currentLocation.name}, {currentLocation.state}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5D7188] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 sm:absolute sm:inset-x-auto sm:left-0 top-[4.25rem] sm:top-full mt-1 sm:w-80 max-h-[75vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-[#D7E7F5] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 glass-panel">
          <div className="relative mb-2.5">
            <Search className="w-4 h-4 text-[#5D7188] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search city, district or state..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5FAFF] border border-[#D7E7F5] rounded-xl text-[#0F2742] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
              autoFocus
            />
          </div>

          <button
            onClick={handleGPSLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 rounded-xl text-xs font-semibold text-[#1557B0] bg-[#DCEEFF]/60 hover:bg-[#DCEEFF] border border-[#BFDBFE] transition-colors"
          >
            <Navigation className={`w-3.5 h-3.5 text-[#3B82F6] ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Detecting coordinates...' : 'Auto-detect device coordinates'}</span>
          </button>

          <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-2 py-1 mb-1">
            {query ? 'Search Results' : 'Calibrated & Monitored Meteorological Stations'}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredLocations.map((loc) => {
              const isSelected = loc.id === currentLocation.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => handleSelect(loc)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#DCEEFF] text-[#1557B0] font-bold border border-[#BFDBFE]'
                      : 'text-[#0F2742] hover:bg-[#F5FAFF]'
                  }`}
                >
                  <div className="text-left truncate">
                    <div className="font-medium text-sm text-[#0F2742]">{loc.name}</div>
                    <div className="text-[11px] text-[#5D7188] font-mono-stat">{loc.state} • {loc.lat.toFixed(2)}°N, {loc.lng.toFixed(2)}°E</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#3B82F6]" />}
                </button>
              );
            })}

            {filteredLocations.length === 0 && (
              <div className="text-xs text-[#5D7188] p-4 text-center">No location found for "{query}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
