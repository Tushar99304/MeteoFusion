import React, { useState, useRef, useEffect } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { searchLocations, getCurrentGeoLocation } from '../../services/locationService';
import { MapPin, Search, Navigation, Check } from 'lucide-react';
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
      // Coordinates, not a name: the backend resolves the position without geocoding.
      setGpsLocation(loc.lat, loc.lng);
      setIsOpen(false);
    } catch {
      alert('Unable to detect GPS position. Please choose a city from the list.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#DCEAE2] text-[#17352A] font-medium text-sm hover:border-[#6BAF92] transition-colors shadow-xs"
      >
        <MapPin className="w-4 h-4 text-[#2E7D5B]" />
        <span>{currentLocation.name}, {currentLocation.state}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-[#DCEAE2] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-[#6B7D74] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search city or district..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7FBF8] border border-[#DCEAE2] rounded-lg text-[#17352A] focus:outline-none focus:border-[#2E7D5B]"
              autoFocus
            />
          </div>

          <button
            onClick={handleGPSLocation}
            disabled={isLocating}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg text-xs font-medium text-[#2E7D5B] bg-[#E8F5EE] hover:bg-[#2E7D5B] hover:text-white transition-colors"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Detecting GPS Location...' : 'Use Current GPS Location'}</span>
          </button>

          <div className="text-[11px] font-semibold text-[#6B7D74] uppercase tracking-wider px-1 mb-1">
            {query ? 'Search Results' : 'Popular Cities'}
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredLocations.map((loc) => {
              const isSelected = loc.id === currentLocation.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => handleSelect(loc)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#E8F5EE] text-[#2E7D5B] font-semibold'
                      : 'text-[#17352A] hover:bg-[#F7FBF8]'
                  }`}
                >
                  <div className="text-left truncate">
                    <div className="truncate">{loc.name}</div>
                    <div className="text-[10px] text-[#6B7D74]">{loc.state}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#2E7D5B]" />}
                </button>
              );
            })}

            {filteredLocations.length === 0 && (
              <div className="text-xs text-[#6B7D74] p-3 text-center">No location found matching "{query}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
