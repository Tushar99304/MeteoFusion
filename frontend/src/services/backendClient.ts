/**
 * backendClient.ts — the ONLY module that talks to the FastAPI backend.
 *
 * Base URL is SAME-ORIGIN by default (empty string) so the app works behind the FastAPI
 * static host AND behind the Vite dev proxy (vite.config proxies /api and /health -> :8000).
 * VITE_API_BASE_URL may override it (e.g. https://api.example.com/api) for split deploys.
 *
 * No API keys, tokens or secrets are ever read here — the backend holds all credentials.
 */
import type {
  BackendClimateResponse,
  BackendHealth,
  BackendOverviewResponse,
  BackendQueryResponse,
} from '../types/backend';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
// If a full origin is configured (e.g. http://localhost:8000/api) use it as-is; an empty
// value means "same origin" -> relative paths ("" + "/api/query").
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

export class BackendError extends Error {
  readonly status?: number;
  readonly kind: 'network' | 'http' | 'bad_payload';
  constructor(
    message: string,
    status?: number,
    kind: 'network' | 'http' | 'bad_payload' = 'network',
  ) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.kind = kind;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (err) {
    throw new BackendError(
      `backend unreachable at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      'network',
    );
  }
  if (!res.ok) {
    throw new BackendError(`backend returned HTTP ${res.status} for ${path}`, res.status, 'http');
  }
  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new BackendError(`bad JSON from ${path}: ${String(err)}`, res.status, 'bad_payload');
  }
}

export interface QueryParams {
  message: string;
  locationHint?: string;
  activity?: string;
  latitude?: number;
  longitude?: number;
  includePipeline?: boolean;
  /**
   * U3: conversation id for context continuity (follow-ups without repeating the place).
   * If omitted, the SHARED active session id is used automatically, so every feature that
   * sends a natural-language query (Chat, Voice, follow-ups) shares one session. Pass an
   * explicit id only to override; the app never generates a per-request id.
   */
  sessionId?: string;
  /**
   * True (default) = a user-to-assistant turn that participates in conversation context.
   * Background UI data-sync calls (dashboard current/forecast/alerts) pass false so they
   * neither read nor write the active conversation's memory.
   */
  conversational?: boolean;
  /**
   * U4: the user's selected response language ('en' | 'hi' | 'mr' | 'hinglish'). Sent as
   * structured request metadata; the backend places it inside the single Evidence object
   * (ev.request.response_language) so the answer AND the TTS voice follow the choice.
   */
  language?: 'en' | 'hi' | 'mr' | 'hinglish' | string;
}

/** POST /api/query — the full grounded pipeline (chat, dashboard, advisory, alerts). */
export function queryBackend(params: QueryParams): Promise<BackendQueryResponse> {
  return request<BackendQueryResponse>('/api/query', {
    method: 'POST',
    body: JSON.stringify({
      message: params.message,
      location_hint: params.locationHint,
      activity: params.activity,
      latitude: params.latitude,
      longitude: params.longitude,
      include_pipeline: params.includePipeline ?? false,
      session_id: params.sessionId ?? getSessionId(),
      conversational: params.conversational ?? true,
      language: params.language,
    }),
  });
}

/** POST /api/session/reset — forget a conversation's context (new chat / clear). */
export function resetSession(sessionId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/session/reset', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

/**
 * Mint a stable per-conversation id (persisted across reloads). The backend keeps only a small
 * structured context keyed by this id; an id is opaque so one tab cannot read another's context.
 */
const SESSION_KEY = 'weathergpt.session_id';
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (globalThis.crypto?.randomUUID?.() as string | undefined) ??
        `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // SSR / storage disabled: a per-process fallback still keeps continuity within the tab.
    if (!FALLBACK_ID) {
      FALLBACK_ID = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return FALLBACK_ID;
  }
}
let FALLBACK_ID: string | null = null;

/** Start a fresh conversation: rotate the id and ask the backend to forget the old context. */
export async function newSessionId(): Promise<string> {
  const old = getSessionId();
  try {
    await resetSession(old).catch(() => undefined);
  } catch {
    /* network may be offline; local rotation still prevents stale UI context */
  }
  const id =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    FALLBACK_ID = id;
  }
  return id;
}

/** GET /health — secret-free provider/LLM/alert configuration for connection status. */
export function fetchHealth(): Promise<BackendHealth> {
  return request<BackendHealth>('/health');
}

/** GET /api/overview — read-only current-conditions summary for the map/dashboard. */
export function fetchOverview(): Promise<BackendOverviewResponse> {
  return request<BackendOverviewResponse>('/api/overview');
}

/** GET /api/climate?place= — research/repro historical trends (NEVER official IMD data). */
export function fetchClimate(place: string): Promise<BackendClimateResponse> {
  return request<BackendClimateResponse>(
    `/api/climate?place=${encodeURIComponent(place)}`,
  );
}
