import React, { useState } from 'react';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { askWeatherGPT } from '../../services/chatService';
import { ttsLang, voiceService } from '../../services/voiceService';
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
      voiceService.speak(res.message, ttsLang(selectedLang));
    } catch {
      setLastResponse({
        text: 'Sorry — the MeteoFusion backend could not be reached, so I will not invent an answer. Please try again shortly.',
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
        return 'MeteoFusion is speaking response...';
      case 'error':
        return errorMessage || 'Could not recognize speech.';
      default:
        return 'Tap microphone to speak';
    }
  };

  return (
    <div className="card-3d bg-white/90 backdrop-blur-md border border-[#D7E7F5] rounded-3xl p-6 sm:p-10 shadow-lg max-w-2xl mx-auto space-y-8 text-center relative overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#3B82F6]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#06B6D4]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 relative z-10">
        <span className="text-xs text-[#5D7188] flex items-center gap-1.5 mr-1 font-medium">
          <Languages className="w-3.5 h-3.5 text-[#3B82F6]" /> Dialect:
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
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selectedLang === l.code
                ? 'bg-[#1557B0] text-white border-[#1557B0] shadow-sm'
                : 'bg-[#F5FAFF] text-[#0F2742] border-[#D7E7F5] hover:bg-[#DCEEFF]/50'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Big Mic Button Centerpiece with Sound Wave Rings */}
      <div className="py-8 flex flex-col items-center justify-center relative">
        <div className="relative flex items-center justify-center">
          {/* Animated concentric sound wave rings */}
          {voiceState === 'listening' && (
            <>
              <div className="absolute w-48 h-48 rounded-full border-2 border-red-400/40 animate-ping pointer-events-none" />
              <div className="absolute w-40 h-40 rounded-full border border-red-400/60 animate-pulse pointer-events-none" />
            </>
          )}

          {voiceState === 'speaking' && (
            <>
              <div className="absolute w-48 h-48 rounded-full border-2 border-[#06B6D4]/30 animate-ping pointer-events-none" />
              <div className="absolute w-40 h-40 rounded-full border border-[#3B82F6]/40 animate-pulse pointer-events-none" />
            </>
          )}

          {voiceState === 'idle' && (
            <div className="absolute w-36 h-36 rounded-full bg-[#DCEEFF]/30 animate-pulse pointer-events-none" />
          )}

          <button
            onClick={handleMicToggle}
            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
              voiceState === 'listening'
                ? 'bg-gradient-to-tr from-red-600 to-rose-500 text-white ring-8 ring-red-100 scale-105'
                : voiceState === 'speaking'
                ? 'bg-gradient-to-tr from-[#1557B0] to-[#06B6D4] text-white ring-8 ring-[#DCEEFF] scale-105'
                : 'bg-gradient-to-tr from-[#1557B0] to-[#3B82F6] text-white hover:scale-105 hover:shadow-2xl ring-4 ring-white'
            }`}
            aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start listening'}
          >
            {voiceState === 'listening' ? (
              <Mic className="w-12 h-12 animate-bounce" />
            ) : voiceState === 'speaking' ? (
              <Volume2 className="w-12 h-12 animate-pulse" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>
        </div>

        <p className="font-semibold text-sm text-[#0F2742] mt-6 tracking-wide">{renderStatusText()}</p>
        {!isSupported && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg mt-3">
            Speech Recognition is limited on this browser engine. Web Speech API fallback active.
          </p>
        )}
      </div>

      {/* Transcript Box */}
      {transcript && (
        <div className="bg-[#F5FAFF] border border-[#D7E7F5] p-4 rounded-2xl text-left space-y-1 relative z-10">
          <span className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider font-mono">Recognized Speech:</span>
          <p className="text-sm font-semibold text-[#0F2742]">"{transcript}"</p>
        </div>
      )}

      {/* Response Display Box */}
      {lastResponse && (
        <div className="bg-[#DCEEFF]/30 border border-[#3B82F6]/30 p-5 rounded-2xl text-left space-y-4 animate-in fade-in duration-200 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1557B0] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#06B6D4]" /> Synthesized Evidence Response
            </span>
            <button
              onClick={() => speakText(lastResponse.text, ttsLang(selectedLang))}
              className="p-1.5 rounded-lg bg-white text-[#1557B0] border border-[#D7E7F5] hover:bg-[#3B82F6] hover:text-white transition-all shadow-2xs"
              title="Replay Voice Response"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-[#0F2742] font-medium leading-relaxed bg-white/90 p-4 rounded-xl border border-[#D7E7F5]">
            "{lastResponse.text}"
          </p>

          {lastResponse.evidence && <EvidencePanel evidence={lastResponse.evidence} compact />}
        </div>
      )}
    </div>
  );
};
