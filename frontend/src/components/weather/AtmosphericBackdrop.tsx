import React from 'react';

interface AtmosphericBackdropProps {
  weatherRegime?: string;
  conditionCode?: string;
}

export const AtmosphericBackdrop: React.FC<AtmosphericBackdropProps> = ({
  weatherRegime = 'Normal',
  conditionCode = '',
}) => {
  const isRain =
    weatherRegime === 'Heavy Rain' ||
    conditionCode.toLowerCase().includes('rain') ||
    conditionCode.toLowerCase().includes('drizzle');

  const isWind =
    weatherRegime === 'High Wind' ||
    conditionCode.toLowerCase().includes('wind');

  const isHeat =
    weatherRegime === 'Heat' ||
    conditionCode.toLowerCase().includes('clear') ||
    conditionCode.toLowerCase().includes('sun');

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Soft atmospheric gradient orbs */}
      <div 
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-70 transition-all duration-1000"
        style={{
          background: isHeat 
            ? 'radial-gradient(circle, rgba(254, 215, 170, 0.45) 0%, rgba(220, 238, 255, 0) 70%)'
            : isRain
              ? 'radial-gradient(circle, rgba(147, 197, 253, 0.5) 0%, rgba(220, 238, 255, 0) 70%)'
              : 'radial-gradient(circle, rgba(220, 238, 255, 0.8) 0%, rgba(245, 250, 255, 0) 70%)'
        }}
      />
      <div 
        className="absolute top-1/4 right-0 w-80 h-80 rounded-full blur-3xl opacity-60 transition-all duration-1000"
        style={{
          background: isWind 
            ? 'radial-gradient(circle, rgba(186, 230, 253, 0.5) 0%, rgba(220, 238, 255, 0) 70%)'
            : 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(220, 238, 255, 0) 70%)'
        }}
      />
      <div className="absolute -bottom-40 left-1/3 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-50 bg-gradient-to-tr from-[#DCEEFF]/60 to-transparent" />

      {/* Subtle Coordinate Grid Lines */}
      <div className="absolute inset-0 weather-coord-grid opacity-30" />

      {/* Floating atmospheric particles (rain or ambient) */}
      {isRain ? (
        <div className="absolute inset-0">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="absolute w-[1.5px] bg-gradient-to-b from-blue-300 to-blue-500 rounded-full opacity-40 animate-pulse"
              style={{
                left: `${(i * 6.25 + 3)}%`,
                top: `${(i * 19) % 85}%`,
                height: `${24 + (i % 5) * 8}px`,
                animationDuration: `${1.2 + (i % 4) * 0.4}s`,
                animationDelay: `${(i * 0.15)}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-300/30 blur-[1px] animate-float"
              style={{
                left: `${(i * 12 + 5)}%`,
                top: `${(i * 14 + 10)}%`,
                width: `${4 + (i % 3) * 3}px`,
                height: `${4 + (i % 3) * 3}px`,
                animationDuration: `${5 + (i % 4) * 2}s`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
