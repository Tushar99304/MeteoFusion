import React from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { CloudRain, Wind, Flame, Sun, Activity } from 'lucide-react';

export const WeatherRegimeCard: React.FC = () => {
  const { currentWeather } = useWeatherStore();
  const regime = currentWeather?.blendingMetadata?.weatherRegime || 'Normal';

  const regimeConfig = {
    'Heavy Rain': {
      icon: CloudRain,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      description: 'Active precipitation event triggers high-resolution rainfall weighting heuristics.',
    },
    'High Wind': {
      icon: Wind,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      description: 'Elevated wind shear detected; coastal boundary layer models prioritized.',
    },
    'Heat': {
      icon: Flame,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      description: 'High surface thermal anomalies; convective thermodynamic profiles active.',
    },
    'Normal': {
      icon: Sun,
      color: 'text-[#1557B0]',
      bg: 'bg-[#F5FAFF]',
      border: 'border-[#D7E7F5]',
      description: 'Standard atmospheric stability; standard inverse-MAE calibration applied.',
    },
  }[regime] || {
    icon: Activity,
    color: 'text-[#1557B0]',
    bg: 'bg-[#F5FAFF]',
    border: 'border-[#D7E7F5]',
    description: 'Operating under standard atmospheric baseline.',
  };

  const IconComponent = regimeConfig.icon;

  return (
    <div className={`card-3d p-6 rounded-3xl border ${regimeConfig.border} ${regimeConfig.bg} shadow-xs`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider block">Atmospheric State</span>
        <div className={`w-8 h-8 rounded-xl ${regimeConfig.bg} ${regimeConfig.color} flex items-center justify-center border ${regimeConfig.border}`}>
          <IconComponent className="w-4 h-4" />
        </div>
      </div>

      <div className="mb-2">
        <h3 className="text-lg font-extrabold text-[#0F2742] tracking-tight">WEATHER REGIME</h3>
        <div className={`text-xl font-extrabold ${regimeConfig.color} font-mono-stat mt-0.5`}>
          {regime}
        </div>
      </div>

      <p className="text-xs text-[#5D7188] leading-relaxed">
        {regimeConfig.description}
      </p>
    </div>
  );
};
