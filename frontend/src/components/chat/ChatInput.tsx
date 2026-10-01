import React, { useState } from 'react';
import { Mic, Send, Sparkles } from 'lucide-react';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [input, setInput] = useState('');

  const { voiceState, startListening, stopListening, isSupported } = useVoiceRecognition(
    (transcript) => {
      setInput(transcript);
    }
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleMicClick = () => {
    if (voiceState === 'listening') {
      stopListening();
    } else {
      startListening('en');
    }
  };

  const quickPrompts = [
    'Will it rain today?',
    'Kal Mumbai mein baarish hogi kya?',
    'Any active alerts near me?',
    'Should I travel on expressway?',
  ];

  return (
    <div className="space-y-3">
      {/* Quick Prompts Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSend(prompt)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#DCEEFF]/40 text-[#1557B0] text-xs font-medium border border-[#D7E7F5] hover:bg-[#3B82F6] hover:text-white hover:border-[#3B82F6] transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3 h-3 text-[#06B6D4]" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Main Input Box */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              voiceState === 'listening'
                ? 'Listening... Speak your meteorological question'
                : 'Ask MeteoFusion about hybrid forecast, multi-model consensus, or active alerts...'
            }
            className={`w-full pl-4 pr-12 py-3 bg-[#F5FAFF]/50 border rounded-2xl text-sm text-[#0F2742] placeholder-[#5D7188] focus:outline-none transition-all shadow-xs ${
              voiceState === 'listening'
                ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/20'
                : 'border-[#D7E7F5] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#DCEEFF]'
            }`}
          />

          {isSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              className={`absolute right-2.5 top-2 p-2 rounded-xl transition-all ${
                voiceState === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-[#3B82F6] hover:bg-[#DCEEFF]/50'
              }`}
              title={voiceState === 'listening' ? 'Stop Listening' : 'Speak Question'}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-3 rounded-2xl bg-gradient-to-r from-[#1557B0] to-[#3B82F6] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
