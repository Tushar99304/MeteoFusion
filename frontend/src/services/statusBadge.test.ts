import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Weather and backend connectivity status badges separation', () => {
  beforeEach(() => {
    vi.resetModules();
    // In-memory localStorage mock for node environment
    const storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      length: 0,
      key: () => null,
    };
  });

  it('preserves LIVE BACKEND when backend is reachable but weather provider returns cached data', async () => {
    const { useWeatherStore } = await import('../store/useWeatherStore');
    const { setCachedData } = await import('../utils/cache');

    // Simulate pre-existing cached weather snapshot
    const mockEvidence = {
      source: 'Open-Meteo',
      authority: 'research_repro',
      location: 'Mumbai, Maharashtra',
      observedAt: '18:45',
      temperature: 31.0,
      warningsCount: 0,
    };
    setCachedData('last_query_evidence_v1', {
      evidence: mockEvidence,
      hourly: [],
      daily: [],
      alerts: [],
      location: { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.877 },
      at: '2026-10-01T18:45:00.000Z',
    });

    // Mock fetch: /health succeeds, but /api/query returns an abstention with weather: null (upstream provider failed)
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/health')) {
        return new Response(JSON.stringify({ ok: true, weather_provider: 'multi-source' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/calibration')) {
        return new Response(JSON.stringify({ ok: false, status: 'uncalibrated' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // /api/query returns abstention (weather provider failed on backend)
      return new Response(
        JSON.stringify({
          status: 'abstain',
          user_message: 'test',
          evidence: {
            status: 'abstain',
            weather: null,
            abstain_reason: 'Upstream weather provider failed',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as unknown as typeof fetch;

    const store = useWeatherStore.getState();
    await store.syncData();

    const state = useWeatherStore.getState();
    // 1. Backend connectivity must reflect reachable backend
    expect(state.connection.backendReachable).toBe(true);
    expect(state.connection.apiStatus).toBe('REAL');
    expect(state.connection.apiStatus).not.toBe('OFFLINE');

    // 2. Weather data freshness must reflect cached snapshot
    expect(state.usingCached).toBe(true);
    expect(state.currentWeather).toBeTruthy();
    expect(state.currentWeather?.source).toBe('CACHED');
  });

  it('marks BACKEND OFFLINE when network error occurs but still provides cached weather', async () => {
    const { useWeatherStore } = await import('../store/useWeatherStore');
    const { setCachedData } = await import('../utils/cache');

    setCachedData('last_query_evidence_v1', {
      evidence: {
        source: 'Open-Meteo',
        authority: 'research_repro',
        location: 'Mumbai, Maharashtra',
        observedAt: '18:30',
        temperature: 30.5,
        warningsCount: 0,
      },
      hourly: [],
      daily: [],
      alerts: [],
      location: { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.877 },
      at: '2026-10-01T18:30:00.000Z',
    });

    // Mock fetch throwing network error
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Failed to fetch');
    }) as unknown as typeof fetch;

    const store = useWeatherStore.getState();
    await store.checkHealth();
    await store.syncData();

    const state = useWeatherStore.getState();
    // Backend is unreachable
    expect(state.connection.backendReachable).toBe(false);
    expect(state.connection.apiStatus).toBe('OFFLINE');

    // Weather is using cached fallback
    expect(state.usingCached).toBe(true);
    expect(state.currentWeather?.source).toBe('CACHED');
  });

  it('marks LIVE BACKEND and fresh LIVE WEATHER when fetch succeeds', async () => {
    const { useWeatherStore } = await import('../store/useWeatherStore');

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/health')) {
        return new Response(JSON.stringify({ ok: true, weather_provider: 'multi-source' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          status: 'grounded',
          user_message: 'test',
          evidence: {
            status: 'grounded',
            weather: {
              provider: 'multi-source',
              model: 'weighted-fusion',
              retrieved_at_utc: '2026-10-01T13:30:00Z',
              current: {
                time: '2026-10-01T19:00',
                temperature_c: 29.5,
                humidity_pct: 75,
                weather_code: 1,
                condition: 'Mainly clear',
              },
            },
            location: { name: 'Mumbai', admin1: 'Maharashtra' },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as unknown as typeof fetch;

    const store = useWeatherStore.getState();
    await store.checkHealth();
    await store.syncData();

    const state = useWeatherStore.getState();
    expect(state.connection.backendReachable).toBe(true);
    expect(state.connection.apiStatus).toBe('REAL');
    expect(state.usingCached).toBe(false);
    expect(state.currentWeather?.temperature).toBe(29.5);
  });
});
