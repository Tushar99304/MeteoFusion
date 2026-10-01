import React from 'react';
import { VoiceControl } from '../components/voice/VoiceControl';
import { Mic, Radio } from 'lucide-react';

export const VoicePage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center max-w-lg mx-auto space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCEEFF]/40 border border-[#D7E7F5] text-xs font-semibold text-[#1557B0] mb-1">
          <Radio className="w-3.5 h-3.5 text-[#06B6D4] animate-pulse" />
          <span>Speech Recognition & Synthesis Interface</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#0F2742] flex items-center justify-center gap-2 tracking-tight">
          <Mic className="w-6 h-6 text-[#3B82F6]" />
          Voice Weather Assistant
        </h1>
        <p className="text-xs text-[#5D7188] leading-relaxed">
          Speak natural weather queries in English, Hindi (हिन्दी), Marathi (मराठी), or Hinglish.
          Answers are synthesized from multi-model blending evidence without speculative fabrication.
        </p>
      </div>

      <VoiceControl />
    </div>
  );
};
