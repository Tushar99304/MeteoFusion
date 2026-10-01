import { create } from 'zustand';
import type {
  ActivityCategory,
  CalibrationMetadata,
  ChatMessage,
  ConnectionState,
  DailyForecast,
  HourlyForecast,
  Location,
  UserPreferences,
  WeatherAdvisory,
  WeatherAlert,
  WeatherEvidence,
} from '../types';
import { DEFAULT_LOCATION, POPULAR_LOCATIONS } from '../constants/locations';
import { INITIAL_CHAT_MESSAGES } from '../mocks/chat';
import { getCurrentWeather } from '../services/weatherService';
import { getForecast } from '../services/forecastService';
import { getActiveAlerts } from '../services/alertService';
import { getAdvisoryForActivity } from '../services/advisoryService';
import { fetchHealth, fetchCalibration, getSessionId, newSessionId, BackendError } from '../services/backendClient';
import { mapCalibrationMetadata } from '../services/mappers';
import { getCachedData, setCachedData } from '../utils/cache';

/**
 * The store drives all pages from REAL backend evidence by default. `preferences.demoMode`
 * (default OFF) switches to clearly-labelled bundled SAMPLE data. When the backend is
 * unreachable we show the last successfully fetched (cached) evidence with an explicit
 * "cached / not live" badge — never fabricated numbers presented as current.
 */

const CACHE_KEY = 'last_query_evidence_v1';

interface CachedSnapshot {
  evidence: WeatherEvidence | undefined;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  alerts: WeatherAlert[];
  location: Location;
  at: string;
}

interface WeatherStoreState {
  currentLocation: Location;
  popularLocations: Location[];
  setLocation: (location: Location) => void;
  setGpsLocation: (lat: number, lng: number) => void;

  currentWeather: WeatherEvidence | null;
  hourlyForecast: HourlyForecast[];
  dailyForecast: DailyForecast[];
  alerts: WeatherAlert[];
  expiredAlerts: WeatherAlert[];
  advisory: WeatherAdvisory | null;
  calibration: CalibrationMetadata | null;
  fetchActiveCalibration: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  usingSample: boolean;
  usingCached: boolean;
  lastQueriedAt: string | null;

  connection: ConnectionState;
  setOnlineStatus: (isOnline: boolean) => void;
  syncData: () => Promise<void>;
  checkHealth: () => Promise<void>;

  preferences: UserPreferences;
  toggleDemoMode: () => void;
  setTempUnit: (unit: '°C' | '°F') => void;
  setWindUnit: (unit: 'km/h' | 'm/s') => void;
  setLanguage: (lang: 'en' | 'hi' | 'mr') => void;
  setSmsAlerts: (enabled: boolean) => void;

  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  /** U3: opaque conversation id for backend context continuity (follow-ups). */
  sessionId: string;

  selectedActivity: ActivityCategory;
  setSelectedActivity: (activity: ActivityCategory) => void;

  activeEvidenceDrawer: WeatherEvidence | null;
  setActiveEvidenceDrawer: (evidence: WeatherEvidence | null) => void;
  activeAlertModal: WeatherAlert | null;
  setActiveAlertModal: (alert: WeatherAlert | null) => void;

  isMobileSidePanelOpen: boolean;
  setMobileSidePanelOpen: (open: boolean) => void;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const useWeatherStore = create<WeatherStoreState>((set, get) => ({
  currentLocation: DEFAULT_LOCATION,
  popularLocations: POPULAR_LOCATIONS,

  currentWeather: null,
  hourlyForecast: [],
  dailyForecast: [],
  alerts: [],
  expiredAlerts: [],
  advisory: null,
  calibration: null,
  isLoading: false,
  error: null,
  usingSample: false,
  usingCached: false,
  lastQueriedAt: null,

  connection: {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    backendReachable: true,
    apiStatus: 'REAL',
    lastSyncedAt: null,
    syncInProgress: false,
    activeSource: '—',
  },

  preferences: {
    tempUnit: '°C',
    windUnit: 'km/h',
    language: 'en',
    demoMode: false, // LIVE by default — sample data is an explicit, labelled opt-in.
    smsAlertsEnabled: false,
    pushNotifications: true,
    autoDetectLocation: false,
  },

  messages: INITIAL_CHAT_MESSAGES,

  // U3: stable per-conversation id; the backend keeps only a small structured context per id.
  sessionId: getSessionId(),

  selectedActivity: 'Driving',
  activeEvidenceDrawer: null,
  activeAlertModal: null,
  isMobileSidePanelOpen: false,
  setMobileSidePanelOpen: (open) => set({ isMobileSidePanelOpen: open }),

  setLocation: (location) => {
    set({ currentLocation: location });
    void get().syncData();
  },

  setGpsLocation: (lat, lng) => {
    const gpsLoc: Location = {
      id: `gps-${lat.toFixed(3)}-${lng.toFixed(3)}`,
      name: 'Your current location',
      state: 'Device location',
      lat,
      lng,
    };
    set({ currentLocation: gpsLoc });
    // Coordinates are passed via the location hint; the backend resolves them when the query
    // names no place. We send an explicit "weather here" message so no geocoder is needed.
    void get().syncData();
  },

  setOnlineStatus: (isOnline) => {
    const { connection } = get();
    set({
      connection: {
        ...connection,
        isOnline,
        backendReachable: isOnline ? connection.backendReachable : false,
        apiStatus: isOnline ? connection.apiStatus : 'OFFLINE',
        activeSource: isOnline ? connection.activeSource : 'CACHED',
      },
    });
    if (isOnline) void get().checkHealth();
  },

  checkHealth: async () => {
    try {
      const health = await fetchHealth();
      set((s) => ({
        connection: {
          ...s.connection,
          backendReachable: true,
          isOnline: true,
          apiStatus: s.preferences.demoMode ? 'DEMO' : 'REAL',
          llmConfigured: health.llm?.configured,
          alertsEnabled: health.alerts?.enabled,
          activeSource: health.weather_provider || 'backend',
        },
      }));
    } catch {
      set((s) => ({
        connection: {
          ...s.connection,
          backendReachable: false,
          apiStatus: s.connection.isOnline ? 'DEGRADED' : 'OFFLINE',
        },
      }));
    }
  },

  fetchActiveCalibration: async () => {
    try {
      const res = await fetchCalibration();
      if (res.ok && res.metadata) {
        const mapped = mapCalibrationMetadata(res.metadata);
        if (mapped) {
          set({ calibration: mapped });
        }
      }
    } catch {
      // Backend may be offline or in fallback mode
    }
  },

  syncData: async () => {
    const { currentLocation, preferences, connection } = get();
    set({ isLoading: true, error: null });
    set({ connection: { ...connection, syncInProgress: true } });

    // GPS fix: pass coordinates (the backend resolves a "lat,lon" hint without geocoding when
    // the message names no place). Named places use "Name, State" and go through the geocoder.
    const isGps = currentLocation.id.startsWith('gps-');
    const hint = isGps
      ? `${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)}`
      : `${currentLocation.name}, ${currentLocation.state}`;
    const demo = preferences.demoMode;

    try {
      void get().fetchActiveCalibration();
      const [weather, forecast, alerts] = await Promise.all([
        getCurrentWeather(currentLocation.id, demo, hint),
        getForecast(currentLocation.id, demo, hint),
        getActiveAlerts(currentLocation.id, demo, hint),
      ]);

      if (demo || weather.isSample) {
        const updateTime = nowLabel();
        set({
          currentWeather: weather.evidence ?? null,
          hourlyForecast: forecast.hourly,
          dailyForecast: forecast.daily,
          alerts: alerts.active,
          expiredAlerts: alerts.expired,
          isLoading: false,
          usingSample: true,
          usingCached: false,
          lastQueriedAt: updateTime,
          error: null,
          connection: {
            ...get().connection,
            backendReachable: true,
            syncInProgress: false,
            apiStatus: 'DEMO',
            lastSyncedAt: updateTime,
            activeSource: 'SAMPLE DATA',
          },
        });
        return;
      }

      // Check if weather provider successfully returned fresh evidence
      if (weather.evidence) {
        const updateTime = nowLabel();
        set({
          currentWeather: weather.evidence,
          hourlyForecast: forecast.hourly,
          dailyForecast: forecast.daily,
          alerts: alerts.active,
          expiredAlerts: alerts.expired,
          isLoading: false,
          usingSample: false,
          usingCached: false,
          lastQueriedAt: updateTime,
          error: null,
          connection: {
            ...get().connection,
            backendReachable: true,
            syncInProgress: false,
            isOnline: true,
            apiStatus: 'REAL',
            lastSyncedAt: updateTime,
            activeSource: weather.evidence.source || 'backend',
          },
        });

        const snapshot: CachedSnapshot = {
          evidence: weather.evidence,
          hourly: forecast.hourly,
          daily: forecast.daily,
          alerts: alerts.active,
          location: currentLocation,
          at: new Date().toISOString(),
        };
        setCachedData(CACHE_KEY, snapshot);
      } else {
        // Backend was reached, but weather provider failed/abstained (no weather evidence returned).
        // Fall back to cached weather snapshot without marking backend offline!
        const cached = getCachedData<CachedSnapshot>(CACHE_KEY);
        if (cached?.data?.evidence) {
          const snap = cached.data;
          const cachedTime = snap.at
            ? new Date(snap.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : (get().connection.lastSyncedAt || nowLabel());
          set({
            currentWeather: {
              warningsCount: 0,
              ...snap.evidence,
              source: 'CACHED',
              authority: 'research_repro',
              sourcePriority: 'CACHED_LOCAL',
              location: snap.evidence?.location ?? snap.location.name,
            },
            hourlyForecast: snap.hourly,
            dailyForecast: snap.daily,
            alerts: snap.alerts,
            isLoading: false,
            usingCached: true,
            usingSample: false,
            error: null,
            connection: {
              ...get().connection,
              backendReachable: true,
              syncInProgress: false,
              apiStatus: 'REAL',
              activeSource: 'CACHED',
              lastSyncedAt: cachedTime,
            },
          });
        } else {
          set({
            currentWeather: null,
            isLoading: false,
            usingCached: false,
            error: 'Weather provider is currently unavailable and no cached evidence is available.',
            connection: {
              ...get().connection,
              backendReachable: true,
              syncInProgress: false,
              apiStatus: 'DEGRADED',
              activeSource: '—',
            },
          });
        }
      }
    } catch (err) {
      // Live fetch failed (e.g. backend unreachable, network drop, or server error)
      const isNetworkError =
        (err instanceof BackendError && err.kind === 'network') ||
        (err instanceof Error && err.message.toLowerCase().includes('failed to fetch'));
      const cached = getCachedData<CachedSnapshot>(CACHE_KEY);
      if (cached?.data?.evidence) {
        const snap = cached.data;
        const cachedTime = snap.at
          ? new Date(snap.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : (get().connection.lastSyncedAt || nowLabel());
        set({
          currentWeather: {
            warningsCount: 0,
            ...snap.evidence,
            source: 'CACHED',
            authority: 'research_repro',
            sourcePriority: 'CACHED_LOCAL',
            location: snap.evidence?.location ?? snap.location.name,
          },
          hourlyForecast: snap.hourly,
          dailyForecast: snap.daily,
          alerts: snap.alerts,
          isLoading: false,
          usingCached: true,
          usingSample: false,
          error: null,
          connection: {
            ...get().connection,
            backendReachable: !isNetworkError,
            syncInProgress: false,
            apiStatus: isNetworkError ? 'OFFLINE' : 'DEGRADED',
            activeSource: 'CACHED',
            lastSyncedAt: cachedTime,
          },
        });
      } else {
        set({
          currentWeather: null,
          isLoading: false,
          usingCached: false,
          error:
            err instanceof Error
              ? err.message
              : 'Could not reach the MeteoFusion backend and no cached evidence is available.',
          connection: {
            ...get().connection,
            backendReachable: !isNetworkError,
            syncInProgress: false,
            apiStatus: isNetworkError ? 'OFFLINE' : 'DEGRADED',
            activeSource: '—',
          },
        });
      }
    }
  },

  toggleDemoMode: () => {
    set((s) => {
      const nextDemo = !s.preferences.demoMode;
      return {
        preferences: { ...s.preferences, demoMode: nextDemo },
        connection: {
          ...s.connection,
          apiStatus: nextDemo ? 'DEMO' : s.connection.backendReachable ? 'REAL' : 'OFFLINE',
          activeSource: nextDemo ? 'SAMPLE DATA' : s.connection.activeSource,
        },
      };
    });
    void get().syncData();
  },

  setTempUnit: (tempUnit) => set((s) => ({ preferences: { ...s.preferences, tempUnit } })),
  setWindUnit: (windUnit) => set((s) => ({ preferences: { ...s.preferences, windUnit } })),
  setLanguage: (language) => set((s) => ({ preferences: { ...s.preferences, language } })),
  setSmsAlerts: (smsAlertsEnabled) =>
    set((s) => ({ preferences: { ...s.preferences, smsAlertsEnabled } })),

  addMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    set((state) => ({ messages: [...state.messages, newMsg] }));
  },

  // Clearing the chat starts a fresh conversation: reset the UI AND the backend's remembered
  // context (rotate the session id + call /api/session/reset) so no prior location/topic leaks.
  clearChat: () => {
    const old = get().sessionId;
    set({ messages: INITIAL_CHAT_MESSAGES });
    void newSessionId()
      .then((id) => set({ sessionId: id }))
      .catch(() => undefined);
    // Best-effort backend forget of the old id (network may be offline).
    void import('../services/backendClient')
      .then((m) => m.resetSession(old))
      .catch(() => undefined);
  },

  setSelectedActivity: (selectedActivity) => set({ selectedActivity }),
  setActiveEvidenceDrawer: (activeEvidenceDrawer) => set({ activeEvidenceDrawer }),
  setActiveAlertModal: (activeAlertModal) => set({ activeAlertModal }),
}));

/** Convenience selector for components that need the advisory for the current activity. */
export async function loadAdvisory(
  activity: ActivityCategory,
  locationName: string,
  demo: boolean,
) {
  return getAdvisoryForActivity(activity, locationName, demo);
}
