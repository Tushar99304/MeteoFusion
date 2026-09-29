import React from 'react';
import type { SourceType } from '../../types';
import { ShieldCheck, Database, Radio, HardDrive, FlaskConical } from 'lucide-react';

interface SourceBadgeProps {
  source: SourceType | string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  authority?: string;
}

/**
 * Source badges reflect the backend's authority model truthfully:
 *  - NDMA SACHET is the only OFFICIAL source (disaster alerts).
 *  - Open-Meteo is research/reproducibility model data (never "IMD official").
 *  - SAMPLE DATA / CACHED are explicitly labelled so demo/offline content is never
 *    mistaken for a live official feed.
 */
export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  showIcon = true,
  size = 'sm',
  authority,
}) => {
  let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
  let label: string = source;
  let Icon = Database;

  const s = String(source);
  if (s.includes('SACHET') || s.includes('NDMA')) {
    badgeStyle = 'bg-red-50 text-red-700 border-red-200 font-semibold';
    label = 'NDMA SACHET · Official';
    Icon = Radio;
  } else if (s.includes('SAMPLE')) {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
    label = 'Sample data (demo)';
    Icon = FlaskConical;
  } else if (s.includes('CACHED')) {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
    label = 'Cached (offline)';
    Icon = HardDrive;
  } else if (s.includes('Open-Meteo') || s.includes('open-meteo')) {
    badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
    label = authority === 'official' ? 'Open-Meteo' : 'Open-Meteo · research/repro';
    Icon = Database;
  } else if (s.includes('GFS')) {
    badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'GFS model · research/repro';
    Icon = Database;
  } else {
    badgeStyle = 'bg-[#E8F5EE] text-[#2E7D5B] border-[#6BAF92]/40';
    label = s;
    Icon = ShieldCheck;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border ${padding} ${badgeStyle}`}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      <span>{label}</span>
    </span>
  );
};
