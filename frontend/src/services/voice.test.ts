/**
 * voice.test.ts — U4 voice-language selection.
 * ttsLang maps the app's response language to a BCP-47 TTS tag: Hindi -> hi-IN,
 * Marathi -> mr-IN, Hinglish (Romanized Hindi) -> hi-IN, English -> en-IN.
 */
import { describe, it, expect } from 'vitest';
import { ttsLang } from './voiceService';

describe('ttsLang BCP-47 mapping', () => {
  it('maps each UI language to the correct TTS locale', () => {
    expect(ttsLang('en')).toBe('en-IN');
    expect(ttsLang('hi')).toBe('hi-IN');
    expect(ttsLang('mr')).toBe('mr-IN');
    expect(ttsLang('hinglish')).toBe('hi-IN');
  });

  it('falls back to en-IN for unknown/empty values', () => {
    expect(ttsLang(undefined)).toBe('en-IN');
    expect(ttsLang(null)).toBe('en-IN');
    expect(ttsLang('xx')).toBe('en-IN');
  });
});
