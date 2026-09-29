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
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#E8F5EE] text-[#2E7D5B] text-xs font-medium border border-[#6BAF92]/30 hover:bg-[#2E7D5B] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" />
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
                ? 'Listening... Speak your question'
                : 'Ask WeatherGPT anything about weather, alerts or travel risk...'
            }
            className={`w-full pl-4 pr-12 py-3 bg-white border rounded-2xl text-sm text-[#17352A] placeholder-[#6B7D74] focus:outline-none transition-all shadow-xs ${
              voiceState === 'listening'
                ? 'border-amber-500 ring-2 ring-amber-200'
                : 'border-[#DCEAE2] focus:border-[#2E7D5B] focus:ring-2 focus:ring-[#E8F5EE]'
            }`}
          />

          {isSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              className={`absolute right-2.5 top-2 p-2 rounded-xl transition-all ${
                voiceState === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-[#2E7D5B] hover:bg-[#E8F5EE]'
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
          className="p-3 rounded-2xl bg-[#2E7D5B] text-white hover:bg-[#236347] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
