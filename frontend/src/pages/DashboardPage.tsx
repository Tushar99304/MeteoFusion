import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CurrentWeatherCard } from '../components/dashboard/CurrentWeatherCard';
import { WeatherSummary } from '../components/dashboard/WeatherSummary';
import { HourlyForecastScroll } from '../components/dashboard/HourlyForecastScroll';
import { DailyForecastList } from '../components/dashboard/DailyForecastList';
import { WeatherInsightCard } from '../components/dashboard/WeatherInsightCard';
import { useWeatherStore } from '../store/useWeatherStore';
import { Search, Mic, Send, Sparkles } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const { currentLocation } = useWeatherStore();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/chat?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handleSuggestionClick = (query: string) => {
    navigate(`/chat?q=${encodeURIComponent(query)}`);
  };

  const suggestions = [
    "Will it rain today?",
    "Weather tomorrow",
    "Any alerts near me?",
    "Should I travel?",
    "Show rainfall forecast",
  ];

  return (
    <div className="space-y-6">
      {/* Top Hero Conversational Input Section */}
      <section className="bg-gradient-to-br from-white via-[#F7FBF8] to-[#E8F5EE] border border-[#DCEAE2] rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-semibold text-[#2E7D5B] bg-[#E8F5EE] px-3 py-1 rounded-full border border-[#6BAF92]/40">
            Good afternoon • {currentLocation.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17352A] tracking-tight mt-2">
            How can I help with the weather today?
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7D74] mt-1">
            Grounded weather evidence from Open-Meteo with official NDMA/SACHET alert priority and
            deterministic travel-risk support.
          </p>
        </div>

        {/* Large Conversational Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#6B7D74] absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ask anything about the weather (e.g. 'Will it rain today in Mumbai?')..."
              className="w-full pl-11 pr-12 py-3.5 bg-white border border-[#DCEAE2] rounded-2xl text-sm text-[#17352A] placeholder-[#6B7D74] focus:outline-none focus:border-[#2E7D5B] focus:ring-2 focus:ring-[#E8F5EE] transition-all shadow-xs"
            />
            <button
              type="button"
              onClick={() => navigate('/voice')}
              className="absolute right-3 top-2.5 p-1.5 rounded-xl text-[#2E7D5B] hover:bg-[#E8F5EE] transition-colors"
              title="Voice Assistant"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          <button
            type="submit"
            className="ml-2 px-5 py-3.5 rounded-2xl bg-[#2E7D5B] text-white font-semibold text-sm hover:bg-[#236347] transition-colors shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <span>Ask</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto pt-1 scrollbar-none">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(s)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-white border border-[#DCEAE2] text-[#17352A] text-xs font-medium hover:border-[#2E7D5B] hover:bg-[#E8F5EE] transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Weather Card */}
      <CurrentWeatherCard />

      {/* AI Grounded Synthesis Insight */}
      <WeatherInsightCard />

      {/* Hourly Forecast */}
      <HourlyForecastScroll />

      {/* Detailed Weather Metrics */}
      <WeatherSummary />

      {/* 7-Day Forecast */}
      <DailyForecastList />
    </div>
  );
};
