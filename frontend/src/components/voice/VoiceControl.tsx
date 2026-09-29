import React, { useState } from 'react';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { askWeatherGPT } from '../../services/chatService';
import { ttsLang } from '../../services/voiceService';
import { useWeatherStore } from '../../store/useWeatherStore';
import { Mic, Volume2, Sparkles, Languages } from 'lucide-react';
import { EvidencePanel } from '../common/EvidencePanel';

export const VoiceControl: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi' | 'mr' | 'hinglish'>('en');
  const [lastResponse, setLastResponse] = useState<{ text: string; evidence?: any } | null>(null);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);

  // sessionId is the SHARED conversation id: Voice uses the exact same session as Chat, so a
  // follow-up spoken after a chat turn ("Is it going to rain?") reuses the established place.
  const { currentLocation, preferences, sessionId } = useWeatherStore();

  const {
    voiceState,
    transcript,
    errorMessage,
    isSupported,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  } = useVoiceRecognition(async (capturedTranscript) => {
    setIsProcessingResponse(true);
    try {
      const res = await askWeatherGPT(
        capturedTranscript,
        `${currentLocation.name}, ${currentLocation.state}`,
        // U4: pass the selection straight through — Hinglish IS a response language (Romanized
        // Hindi), not English; the backend auto-detects when a transcript doesn't match it.
        selectedLang,
        preferences.demoMode,
        undefined,
        // U3: the SAME shared session as Chat — never a per-request id.
        sessionId,
      );
      setLastResponse({
        text: res.message,
        evidence: res.evidence,
      });

      // Automatically speak out the grounded response in the matching locale (hi-IN/mr-IN/en-IN).
      speakText(res.message, ttsLang(selectedLang));
    } catch {
      setLastResponse({
        text: 'Sorry — the WeatherGPT backend could not be reached, so I will not invent an answer. Please try again shortly.',
      });
    } finally {
      setIsProcessingResponse(false);
    }
  });

  const handleMicToggle = () => {
    if (voiceState === 'listening') {
      stopListening();
    } else if (voiceState === 'speaking') {
      stopSpeaking();
    } else {
      startListening(selectedLang);
    }
  };

  const renderStatusText = () => {
    if (isProcessingResponse) return 'Understanding your question...';
    switch (voiceState) {
      case 'listening':
        return 'Listening to your question...';
      case 'processing':
        return 'Retrieving & validating weather evidence...';
      case 'speaking':
        return 'WeatherGPT is speaking response...';
      case 'error':
        return errorMessage || 'Could not recognize speech.';
      default:
        return 'Tap microphone to speak';
    }
  };

  return (
    <div className="bg-white border border-[#DCEAE2] rounded-3xl p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6 text-center">
      {/* Language Switcher Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-[#6B7D74] flex items-center gap-1 mr-2">
          <Languages className="w-4 h-4 text-[#2E7D5B]" /> Language:
        </span>
        {[
          { code: 'en', label: 'English' },
          { code: 'hi', label: 'हिन्दी' },
          { code: 'mr', label: 'मराठी' },
          { code: 'hinglish', label: 'Hinglish' },
        ].map((l) => (
          <button
            key={l.code}
            onClick={() => setSelectedLang(l.code as any)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedLang === l.code
                ? 'bg-[#2E7D5B] text-white border-[#2E7D5B] shadow-xs'
                : 'bg-[#F7FBF8] text-[#17352A] border-[#DCEAE2] hover:bg-[#E8F5EE]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Big Mic Button Centerpiece */}
      <div className="py-6 flex flex-col items-center justify-center">
        <button
          onClick={handleMicToggle}
          className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
            voiceState === 'listening'
              ? 'bg-red-500 text-white ring-8 ring-red-200 animate-pulse scale-105'
              : voiceState === 'speaking'
              ? 'bg-[#2E7D5B] text-white ring-8 ring-[#E8F5EE] scale-105'
              : 'bg-gradient-to-br from-[#2E7D5B] to-[#6BAF92] text-white hover:scale-105'
          }`}
        >
          {voiceState === 'listening' ? (
            <Mic className="w-14 h-14 animate-bounce" />
          ) : voiceState === 'speaking' ? (
            <Volume2 className="w-14 h-14 animate-pulse" />
          ) : (
            <Mic className="w-14 h-14" />
          )}
        </button>

        <p className="font-bold text-base text-[#17352A] mt-4">{renderStatusText()}</p>
        {!isSupported && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg mt-2">
            Speech Recognition is limited on this browser. Web Speech API fallback active.
          </p>
        )}
      </div>

      {/* Transcript Box */}
      {transcript && (
        <div className="bg-[#F7FBF8] border border-[#DCEAE2] p-4 rounded-2xl text-left space-y-1">
          <span className="text-[11px] font-bold text-[#6B7D74] uppercase tracking-wider">You said:</span>
          <p className="text-sm font-semibold text-[#17352A]">"{transcript}"</p>
        </div>
      )}

      {/* Response Display Box */}
      {lastResponse && (
        <div className="bg-[#E8F5EE] border border-[#6BAF92]/40 p-5 rounded-2xl text-left space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2E7D5B] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> WeatherGPT Response
            </span>
            <button
              onClick={() => speakText(lastResponse.text, ttsLang(selectedLang))}
              className="p-1.5 rounded-lg bg-white text-[#2E7D5B] hover:bg-[#2E7D5B] hover:text-white transition-colors"
              title="Replay Voice Response"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-[#17352A] font-medium leading-relaxed bg-white p-3.5 rounded-xl border border-[#DCEAE2]">
            "{lastResponse.text}"
          </p>

          {lastResponse.evidence && <EvidencePanel evidence={lastResponse.evidence} compact />}
        </div>
      )}
    </div>
  );
};
