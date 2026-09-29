import React from 'react';
import { VoiceControl } from '../components/voice/VoiceControl';
import { Mic } from 'lucide-react';

export const VoicePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto space-y-1">
        <h1 className="text-2xl font-extrabold text-[#17352A] flex items-center justify-center gap-2">
          <Mic className="w-6 h-6 text-[#2E7D5B]" />
          Conversational Voice Assistant
        </h1>
        <p className="text-xs text-[#6B7D74]">
          Speak naturally in English, Hindi, Marathi, or Hinglish to receive instant grounded weather answers.
        </p>
      </div>

      <VoiceControl />
    </div>
  );
};
