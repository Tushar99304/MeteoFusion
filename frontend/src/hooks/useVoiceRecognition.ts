import { useState, useCallback } from 'react';
import { voiceService } from '../services/voiceService';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export function useVoiceRecognition(onFinalTranscript?: (transcript: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startListening = useCallback((lang: 'en' | 'hi' | 'mr' | 'hinglish' = 'en') => {
    setErrorMessage(null);
    setTranscript('');
    setVoiceState('listening');

    voiceService.startListening(lang, {
      onTranscript: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setVoiceState('processing');
          if (onFinalTranscript) {
            onFinalTranscript(text);
          }
        }
      },
      onError: (err) => {
        setErrorMessage(err);
        setVoiceState('error');
      },
      onEnd: () => {
        if (voiceState === 'listening') {
          setVoiceState('idle');
        }
      },
    });
  }, [onFinalTranscript, voiceState]);

  const stopListening = useCallback(() => {
    voiceService.stopListening();
    setVoiceState('idle');
  }, []);

  const speakText = useCallback((text: string, lang: string = 'en-IN') => {
    setVoiceState('speaking');
    voiceService.speak(text, lang, () => {
      setVoiceState('idle');
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    voiceService.stopSpeaking();
    setVoiceState('idle');
  }, []);

  return {
    voiceState,
    setVoiceState,
    transcript,
    errorMessage,
    isSupported: voiceService.isSpeechSupported(),
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}
