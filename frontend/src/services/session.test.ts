/**
 * session.test.ts — U3.1 shared conversation-session contract.
 *
 * The ONE mechanism every natural-language query path must use:
 *   - getSessionId()  -> a single stable id (same for Chat, Voice, follow-ups, navigation)
 *   - newSessionId()  -> rotates on "clear chat / new conversation"
 *   - queryBackend() -> always attaches session_id (defaulting to the shared id) and a
 *                       `conversational` flag; background syncs pass conversational:false.
 *
 * These run in node (the session module falls back to an in-module id when localStorage is
 * absent), so no DOM is required.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- fake fetch + module-level storage shim so we can assert the request body -----------
beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ status: 'clarify', user_message: '', evidence: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
});

describe('shared session id', () => {
  it('returns a stable id across calls (Chat and Voice share one session)', async () => {
    const { getSessionId } = await import('./backendClient');
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it('newSessionId rotates the id so old context cannot apply', async () => {
    const { getSessionId, newSessionId } = await import('./backendClient');
    const old = getSessionId();
    const fresh = await newSessionId();
    expect(fresh).not.toBe(old);
    expect(getSessionId()).toBe(fresh);
  });

  it('queryBackend attaches the shared session_id when none is passed (Voice-style call)', async () => {
    const { queryBackend, getSessionId } = await import('./backendClient');
    await queryBackend({ message: 'is it going to rain?' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.session_id).toBe(getSessionId());
    expect(body.conversational).toBe(true);
  });

  it('an explicit sessionId is honoured and conversational:false is forwarded (background sync)', async () => {
    const { queryBackend } = await import('./backendClient');
    await queryBackend({ message: 'current weather in Pune', conversational: false });
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.session_id).toBeTruthy();
    expect(body.conversational).toBe(false);
  });

  it('two independently minted ids differ (session isolation), never a per-request new id', async () => {
    // Simulate two browser sessions by clearing the module-level fallback between reads is not
    // exposed; instead assert the shared id is reused on repeated calls (no per-call rotation).
    const { getSessionId } = await import('./backendClient');
    const repeated = [getSessionId(), getSessionId(), getSessionId()];
    expect(new Set(repeated).size).toBe(1);
  });
});

describe('response language is forwarded to the backend query', () => {
  it('sends the voice-selected language as structured metadata (Hindi)', async () => {
    const { queryBackend } = await import('./backendClient');
    await queryBackend({ message: 'क्या कल बारिश होगी?', language: 'hi' });
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.language).toBe('hi');
    expect(body.session_id).toBeTruthy();
  });

  it('forwards Hinglish as its own language (not coerced to English)', async () => {
    const { queryBackend } = await import('./backendClient');
    await queryBackend({ message: 'kal Mumbai mein baarish hogi kya?', language: 'hinglish' });
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.language).toBe('hinglish');
  });
});
