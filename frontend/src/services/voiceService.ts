/**
 * Voice Assistant Service Abstraction for WeatherGPT
 * Supports Web Speech API for STT & TTS with ready contracts for Whisper/On-Device models
 */

export interface SpeechRecognitionResultHandler {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

// Extend Window interface for Webkit SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class VoiceService {
  private recognition: any = null;
  private isListening: boolean = false;
  private synthesis: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;

  public isSpeechSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public isTTSSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public startListening(
    language: 'en' | 'hi' | 'mr' | 'hinglish',
    handlers: SpeechRecognitionResultHandler
  ): void {
    if (!this.isSpeechSupported()) {
      handlers.onError('Browser Speech Recognition is not supported on this browser. Try typing instead.');
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    // Set BCP-47 language tag
    switch (language) {
      case 'hi':
        this.recognition.lang = 'hi-IN';
        break;
      case 'mr':
        this.recognition.lang = 'mr-IN';
        break;
      case 'hinglish':
      case 'en':
      default:
        this.recognition.lang = 'en-IN';
        break;
    }

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        handlers.onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        handlers.onTranscript(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      handlers.onError(event.error || 'Voice input error occurred');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      handlers.onEnd();
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      handlers.onError('Could not start microphone');
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * U4: pick an actual SpeechSynthesisVoice for the BCP-47 tag — never silently fall back to an
   * English voice when a hi-IN/mr-IN voice IS available. Selection order: exact tag match, then
   * any voice whose language starts with the tag's primary subtag (e.g. "hi" for "hi-IN"), then
   * the same base language (hi for Hinglish), then an Indian English voice, then null. Returns
   * null when no matching voice is exposed by the browser; the utterance keeps its `lang` tag so
   * the browser/OS still routes it to the best engine voice (we never claim a voice we don't see).
   */
  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    if (!this.synthesis) return null;
    const voices = this.synthesis.getVoices();
    if (!voices.length) return null;
    const base = lang.split('-')[0].toLowerCase();
    const exact = voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const sameSubtag = voices.find((v) => (v.lang || '').toLowerCase().startsWith(base));
    if (sameSubtag) return sameSubtag;
    // Hinglish (Romanized Hindi) reads best with a Hindi voice.
    if (base === 'hi') {
      const hi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi'));
      if (hi) return hi;
    }
    const enIn = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en-in'))
      || voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
    return enIn ?? null;
  }

  public speak(text: string, lang: string = 'en-IN', onEnd?: () => void): void {
    if (!this.synthesis) return;

    this.synthesis.cancel(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = this.pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
      // Keep the utterance tag aligned with the chosen voice when the browser requires it.
      utterance.lang = voice.lang || lang;
    }
    utterance.rate = 0.95; // Clear natural pace

    if (onEnd) {
      utterance.onend = onEnd;
    }

    this.synthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
}

/**
 * U4: map the app's response language to the BCP-47 TTS locale. Hinglish text is Romanized
 * Hindi, so it reads with a Hindi (hi-IN) voice; English keeps the Indian English locale.
 */
export function ttsLang(language: 'en' | 'hi' | 'mr' | 'hinglish' | string | null | undefined): string {
  switch (language) {
    case 'hi':
      return 'hi-IN';
    case 'mr':
      return 'mr-IN';
    case 'hinglish':
      return 'hi-IN';
    case 'en':
    default:
      return 'en-IN';
  }
}

export const voiceService = new VoiceService();
