import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import { fetchOverview, fetchDirectWeather, fetchAlertsForPlace } from '../../services/backendClient';
import type { BackendOverviewPlace, BackendWeatherBundle, BackendCurrentWeather } from '../../types/backend';
import { SourceBadge } from '../common/SourceBadge';
import { 
  Layers, 
  CloudRain, 
  Thermometer, 
  Wind, 
  ShieldAlert, 
  Loader2, 
  CloudOff, 
  FlaskConical,
  Cpu,
  Info,
  MapPin,
  Crosshair,
  Navigation,
  X,
  Check,
  ArrowRight,
  Gauge,
  Droplets,
  CloudSun,
  Sparkles,
  MessageSquare,
  Compass
} from 'lucide-react';
import L from 'leaflet';
import { useWeatherStore } from '../../store/useWeatherStore';

// Standard observation station marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom pinpoint marker with glowing radar pulse
const pinpointIcon = L.divIcon({
  className: 'custom-pinpoint-marker',
  html: `
    <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
      <span style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background: #F59E0B; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <span style="position: relative; width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); border: 2.5px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </span>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 32],
  popupAnchor: [0, -32],
});

type LayerKind = 'rain' | 'temp' | 'wind' | 'alerts' | 'models';

interface PinnedLocationData {
  lat: number;
  lng: number;
  placeName: string;
  stateName?: string;
  countryName?: string;
  loading: boolean;
  error?: string;
  current?: BackendCurrentWeather | null;
  weather?: BackendWeatherBundle | null;
  alerts?: string[];
  activeAlertCount: number;
  provider?: string;
  model?: string;
}

/** Map Event Listener & Programmatic Pan/Zoom Controller */
const MapController: React.FC<{
  targetCoords?: [number, number] | null;
  onMapClick: (lat: number, lng: number) => void;
}> = ({ targetCoords, onMapClick }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, Math.max(map.getZoom(), 8), {
        animate: true,
        duration: 1.2,
      });
    }
  }, [targetCoords, map]);

  return null;
};

/** Fast Reverse Geocoding with Graceful Fallback */
async function reverseGeocode(lat: number, lng: number): Promise<{
  name: string;
  state?: string;
  country?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision;
      const state = data.principalSubdivision || '';
      const country = data.countryName || '';
      if (city) {
        return {
          name: city,
          state: state && state !== city ? state : undefined,
          country: country || undefined,
        };
      }
    }
  } catch {
    // Fallback to formatted coordinates if offline or timeout
  }
  return {
    name: `Sector (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)`,
  };
}

export const WeatherMap: React.FC = () => {
  const navigate = useNavigate();
  const { alerts, usingSample, setLocation } = useWeatherStore();
  const [activeLayer, setActiveLayer] = useState<LayerKind>('temp');
  const [places, setPlaces] = useState<BackendOverviewPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pinpoint state
  const [pinned, setPinned] = useState<PinnedLocationData | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [activatedNotification, setActivatedNotification] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOverview()
      .then((res) => {
        if (!cancelled) setPlaces(res.places || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'overview unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const colorFor = (p: BackendOverviewPlace): string => {
    if (activeLayer === 'alerts') {
      const hasAlert = alerts.some((a) => a.affectedArea?.toLowerCase().includes(p.name.toLowerCase()));
      return hasAlert ? '#EF4444' : '#10B981';
    }
    const cur = p.current;
    if (activeLayer === 'temp' && cur?.temperature_c != null) {
      return cur.temperature_c >= 35 ? '#EF4444' : cur.temperature_c >= 28 ? '#F59E0B' : '#3B82F6';
    }
    if (activeLayer === 'wind' && cur?.wind_speed_kmh != null) {
      return cur.wind_speed_kmh >= 40 ? '#EF4444' : cur.wind_speed_kmh >= 25 ? '#06B6D4' : '#3B82F6';
    }
    if (activeLayer === 'models') {
      return '#1557B0';
    }
    // rain
    if (cur?.precipitation_mm != null) {
      return cur.precipitation_mm >= 7.5 ? '#1557B0' : cur.precipitation_mm > 0 ? '#3B82F6' : '#93C5FD';
    }
    return '#3B82F6';
  };

  /** Handle User Dropping a Pin on Any Map Coordinate */
  const handlePinpoint = useCallback(async (lat: number, lng: number) => {
    setFlyToCoords([lat, lng]);
    setPinned({
      lat,
      lng,
      placeName: `Resolving (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)…`,
      loading: true,
      activeAlertCount: 0,
    });
    setActivatedNotification(false);

    try {
      // 1. Concurrently reverse-geocode and fetch multi-source weather telemetry
      const [geo, weatherRes] = await Promise.all([
        reverseGeocode(lat, lng),
        fetchDirectWeather(lat, lng).catch(() => ({ ok: false, weather: undefined })),
      ]);

      const placeName = geo.name;
      const stateName = geo.state;
      const countryName = geo.country;

      let alertsList: string[] = [];

      // 2. If district/state resolved, check NDMA SACHET alert coverage
      if (placeName && stateName) {
        try {
          const alertRes = await fetchAlertsForPlace(placeName, stateName);
          if (alertRes.ok && alertRes.relevant_headlines) {
            alertsList = alertRes.relevant_headlines;
          }
        } catch {
          // Alert check fails safely without blocking weather display
        }
      }

      setPinned({
        lat,
        lng,
        placeName,
        stateName,
        countryName,
        loading: false,
        current: weatherRes.ok && weatherRes.weather?.current ? weatherRes.weather.current : null,
        weather: weatherRes.ok && weatherRes.weather ? weatherRes.weather : null,
        provider: weatherRes.weather?.provider || 'Multi-Source Blend',
        model: weatherRes.weather?.model || 'Weighted NWP + ML',
        alerts: alertsList,
        activeAlertCount: alertsList.length,
      });
    } catch (err) {
      setPinned((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err instanceof Error ? err.message : 'Unable to query location',
            }
          : null
      );
    }
  }, []);

  /** Browser GPS Location Pinpoint */
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void handlePinpoint(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setError(`GPS error: ${err.message}`);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  /** Set Pinned Location into Global Weather Store */
  const handleSetActiveLocation = () => {
    if (!pinned) return;
    setLocation({
      id: `pin-${pinned.lat.toFixed(3)}-${pinned.lng.toFixed(3)}`,
      name: pinned.placeName,
      state: pinned.stateName || 'Custom Pinpoint',
      lat: pinned.lat,
      lng: pinned.lng,
    });
    setActivatedNotification(true);
    setTimeout(() => setActivatedNotification(false), 3000);
  };

  /** Navigate to Forecast with Pinned Location */
  const handleOpenForecast = () => {
    handleSetActiveLocation();
    navigate('/forecast');
  };

  /** Navigate to Chat with Pinned Location */
  const handleAskAi = () => {
    handleSetActiveLocation();
    navigate('/chat');
  };

  /** Clear Pinpoint Selection */
  const handleClearPin = () => {
    setPinned(null);
    setFlyToCoords(null);
    setActivatedNotification(false);
  };

  const layerButton = (id: LayerKind, label: string, Icon: React.ElementType, isAlert = false) => (
    <button
      onClick={() => setActiveLayer(id)}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs shrink-0 ${
        activeLayer === id
          ? isAlert
            ? 'bg-rose-600 text-white shadow-xs'
            : 'bg-[#1557B0] text-white shadow-xs'
          : 'bg-white/90 text-[#0F2742] border border-[#D7E7F5] hover:bg-[#DCEEFF]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="relative w-full h-[calc(100dvh-13.5rem)] min-h-[460px] sm:h-[calc(100vh-11.5rem)] rounded-3xl overflow-hidden border border-[#D7E7F5] shadow-md card-3d">
      {/* Top Floating Glass Controls */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-[1000] glass-panel p-1.5 sm:p-2.5 rounded-2xl shadow-lg flex items-center gap-1.5 overflow-x-auto max-w-full sm:max-w-2xl scrollbar-none">
        <div className="text-[11px] sm:text-xs font-extrabold text-[#0F2742] flex items-center gap-1 px-1 shrink-0">
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6]" />
          <span className="hidden xs:inline">Layers:</span>
        </div>
        {layerButton('temp', 'Temperature', Thermometer)}
        {layerButton('rain', 'Rainfall', CloudRain)}
        {layerButton('wind', 'Wind', Wind)}
        {layerButton('alerts', 'Alerts', ShieldAlert, true)}
        {layerButton('models', 'Sources', Cpu)}

        {/* GPS Locate Me Button */}
        <button
          onClick={handleLocateMe}
          disabled={locating}
          title="Pin my current GPS location"
          className="ml-auto px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-white/90 hover:bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs shrink-0"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span className="hidden sm:inline">My Location</span>
        </button>

        {/* Clear Pin button if active */}
        {pinned && (
          <button
            onClick={handleClearPin}
            title="Clear custom pin"
            className="px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-white/90 hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Pin</span>
          </button>
        )}
      </div>

      {/* Interactive Helper Banner */}
      {!pinned && (
        <div className="absolute top-16 sm:top-20 left-3 right-3 sm:right-auto sm:left-4 z-[1000] glass-panel px-3.5 py-2 rounded-2xl border border-amber-200/80 shadow-md flex items-center gap-2 max-w-sm pointer-events-none animate-in fade-in duration-300">
          <Crosshair className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <p className="text-[11px] font-semibold text-[#0F2742]">
            <span className="text-amber-700 font-extrabold">Pinpoint Mode:</span> Tap or click anywhere on the map to inspect any location.
          </p>
        </div>
      )}

      {/* Model Layer Roadmap Callout (when Model Sources is clicked) */}
      {activeLayer === 'models' && (
        <div className="absolute top-28 sm:top-32 left-3 sm:left-4 right-3 sm:right-auto z-[1000] glass-panel p-3 sm:p-3.5 rounded-2xl border border-blue-200 text-xs text-[#0F2742] max-w-sm shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-bold text-[#1557B0] mb-1">
            <Info className="w-4 h-4 shrink-0" />
            <span>Geospatial Multi-Model Weights</span>
          </div>
          <p className="text-[11px] text-[#5D7188] leading-relaxed">
            Continuous AI-NWP blending integrates ECMWF IFS, NOAA GFS, and neural forecast models at every coordinate. Pinpoint any point to view localized blended output.
          </p>
        </div>
      )}

      {/* Bottom Right Floating Legend (desktop only) */}
      <div className="hidden md:block absolute bottom-4 right-4 z-[1000] glass-panel p-3 rounded-2xl shadow-xl text-xs space-y-1.5 max-w-[230px]">
        <div className="font-extrabold text-[#0F2742] text-[11px] uppercase tracking-wider border-b border-[#D7E7F5] pb-1 flex items-center justify-between">
          <span>
            {activeLayer === 'rain' && 'Precipitation (mm)'}
            {activeLayer === 'temp' && 'Surface Temp (°C)'}
            {activeLayer === 'wind' && 'Wind Speed (km/h)'}
            {activeLayer === 'alerts' && 'NDMA SACHET Zones'}
            {activeLayer === 'models' && 'NWP Station Registry'}
          </span>
          <Compass className="w-3.5 h-3.5 text-[#3B82F6]" />
        </div>
        <p className="text-[10px] text-[#5D7188] leading-relaxed">
          Open-Meteo & SACHET telemetry. Click any coordinate to drop an active pin and query live multi-source weather.
        </p>
      </div>

      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] glass-panel rounded-2xl px-5 py-3 text-xs text-[#1557B0] font-bold flex items-center gap-2 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
          <span>Synchronizing Geospatial Stations…</span>
        </div>
      )}

      {!loading && error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white border border-rose-200 rounded-2xl px-5 py-3 text-xs text-rose-800 font-bold flex items-center gap-2 shadow-lg max-w-sm text-center">
          <CloudOff className="w-5 h-5 text-rose-500" />
          <span>Geospatial feed unreachable ({error}). Points preserved without fabrication.</span>
        </div>
      )}

      {usingSample && (
        <div className="absolute top-20 right-4 z-[1000] bg-amber-50 text-amber-900 border border-amber-300 rounded-xl px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
          <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
          <span>SAMPLE DATA MODE</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FLOATING PINPOINT TELEMETRY CARD (Responsive Drawer on Mobile) */}
      {/* ------------------------------------------------------------- */}
      {pinned && (
        <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-4 sm:left-4 z-[1000] glass-panel rounded-3xl p-4 sm:p-5 shadow-2xl border border-amber-300/80 bg-white/95 backdrop-blur-md sm:max-w-md w-auto animate-in slide-in-from-bottom duration-300 max-h-[70vh] sm:max-h-[82vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#D7E7F5] pb-3">
            <div className="flex items-start gap-2.5">
              <span className="p-2 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-sm shrink-0">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Pinned Location
                  </span>
                  <span className="text-[10px] font-mono-stat text-[#5D7188]">
                    {pinned.lat.toFixed(3)}°N, {pinned.lng.toFixed(3)}°E
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-[#0F2742] tracking-tight mt-0.5">
                  {pinned.placeName}
                </h3>
                {pinned.stateName && (
                  <p className="text-xs font-medium text-[#5D7188]">
                    {pinned.stateName}{pinned.countryName ? `, ${pinned.countryName}` : ''}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleClearPin}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-[#5D7188] hover:text-[#0F2742] transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="py-3 space-y-3">
            {pinned.loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                <p className="text-xs font-bold text-[#0F2742]">
                  Querying multi-source atmospheric telemetry…
                </p>
                <p className="text-[11px] text-[#5D7188]">
                  Blending NWP models and checking NDMA warning feeds
                </p>
              </div>
            ) : pinned.error ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {pinned.error}
              </div>
            ) : (
              <>
                {/* Primary Metric Banner */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F5FAFF] border border-[#D7E7F5]">
                  <div className="flex items-center gap-3">
                    <CloudSun className="w-8 h-8 text-[#3B82F6]" />
                    <div>
                      <div className="text-2xl font-black text-[#0F2742] font-mono-stat">
                        {pinned.current?.temperature_c != null ? `${pinned.current.temperature_c}°C` : '—'}
                      </div>
                      <div className="text-[11px] font-semibold text-[#5D7188]">
                        Feels like {pinned.current?.apparent_temperature_c != null ? `${pinned.current.apparent_temperature_c}°C` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-xl bg-white border border-[#D7E7F5] text-xs font-bold text-[#1557B0] shadow-2xs">
                      {pinned.current?.condition || 'Current Condition'}
                    </span>
                    <div className="text-[10px] text-[#5D7188] mt-1 font-mono-stat">
                      {pinned.provider}
                    </div>
                  </div>
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-white border border-[#D7E7F5] shadow-2xs">
                    <div className="text-[#5D7188] flex items-center gap-1 text-[10px] font-bold">
                      <Wind className="w-3 h-3 text-[#3B82F6]" /> Wind
                    </div>
                    <div className="font-extrabold text-[#0F2742] mt-0.5 font-mono-stat">
                      {pinned.current?.wind_speed_kmh ?? '—'} <span className="text-[9px] font-normal">km/h</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-[#D7E7F5] shadow-2xs">
                    <div className="text-[#5D7188] flex items-center gap-1 text-[10px] font-bold">
                      <Droplets className="w-3 h-3 text-[#3B82F6]" /> Humidity
                    </div>
                    <div className="font-extrabold text-[#0F2742] mt-0.5 font-mono-stat">
                      {pinned.current?.humidity_pct ?? '—'}%
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-[#D7E7F5] shadow-2xs">
                    <div className="text-[#5D7188] flex items-center gap-1 text-[10px] font-bold">
                      <CloudRain className="w-3 h-3 text-[#3B82F6]" /> Rain Depth
                    </div>
                    <div className="font-extrabold text-[#0F2742] mt-0.5 font-mono-stat">
                      {pinned.current?.precipitation_mm ?? '0'} <span className="text-[9px] font-normal">mm</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-[#D7E7F5] shadow-2xs">
                    <div className="text-[#5D7188] flex items-center gap-1 text-[10px] font-bold">
                      <Gauge className="w-3 h-3 text-[#3B82F6]" /> Pressure
                    </div>
                    <div className="font-extrabold text-[#0F2742] mt-0.5 font-mono-stat">
                      {pinned.current?.pressure_hpa ?? '—'} <span className="text-[9px] font-normal">hPa</span>
                    </div>
                  </div>
                </div>

                {/* NDMA SACHET Alert Coverage */}
                {pinned.activeAlertCount > 0 ? (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{pinned.activeAlertCount} Active NDMA SACHET Alert(s)</span>
                    </div>
                    <p className="text-[11px] text-rose-800 line-clamp-2">
                      {pinned.alerts?.[0]}
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2 font-medium">
                    <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>NDMA SACHET checked: No active warnings attached to this zone.</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-1 space-y-2">
                  <button
                    onClick={handleSetActiveLocation}
                    className="w-full py-2 px-3 rounded-2xl bg-[#1557B0] hover:bg-[#0E3D7D] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    {activatedNotification ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Location Activated Globally!</span>
                      </>
                    ) : (
                      <>
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Set as Active Dashboard Location</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleOpenForecast}
                      className="py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E7F5] text-[#0F2742] text-[11px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <span>7-Day Forecast</span>
                      <ArrowRight className="w-3 h-3 text-[#1557B0]" />
                    </button>

                    <button
                      onClick={handleAskAi}
                      className="py-1.5 px-3 rounded-xl bg-[#EBF5FF] hover:bg-[#DCEEFF] border border-[#BFDBFE] text-[#1557B0] text-[11px] font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Ask AI Query</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LEAFLET MAP CONTAINER */}
      {/* ------------------------------------------------------------- */}
      <MapContainer 
        center={[20.5937, 78.9629]} 
        zoom={5} 
        scrollWheelZoom={true} 
        className="w-full h-full cursor-crosshair"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map Click & FlyTo Controller */}
        <MapController targetCoords={flyToCoords} onMapClick={handlePinpoint} />

        {/* Standard Monitored Observation Anchors */}
        {places.map((p) => {
          const color = colorFor(p);
          return (
            <React.Fragment key={p.name}>
              <Marker position={[p.lat, p.lng]} icon={customIcon}>
                <Popup className="custom-popup">
                  <div className="p-2 space-y-2 min-w-52 text-xs text-[#0F2742]">
                    <div className="flex items-center justify-between border-b border-[#D7E7F5] pb-1.5">
                      <strong className="font-extrabold text-sm text-[#0F2742]">{p.name}</strong>
                      <SourceBadge source="Open-Meteo" authority="research_repro" size="sm" />
                    </div>
                    {p.current ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-stat">
                        <div>Temp: <strong className="text-[#0F2742]">{p.current.temperature_c ?? '—'}°C</strong></div>
                        <div>Rain: <strong className="text-[#0F2742]">{p.current.precipitation_mm ?? '—'} mm</strong></div>
                        <div>Wind: <strong className="text-[#0F2742]">{p.current.wind_speed_kmh ?? '—'} km/h</strong></div>
                        <div>Humidity: <strong className="text-[#0F2742]">{p.current.humidity_pct ?? '—'}%</strong></div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#5D7188]">No live observation available.</p>
                    )}
                    <div className="text-[10px] text-[#5D7188] pt-1 border-t border-[#D7E7F5] flex items-center justify-between">
                      <span>{p.current?.condition || 'Current conditions'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePinpoint(p.lat, p.lng);
                        }}
                        className="text-[#1557B0] hover:underline font-bold"
                      >
                        Inspect Point
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Geographic Ring Indicator */}
              <Circle
                center={[p.lat, p.lng]}
                radius={45000}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.22,
                  weight: 2,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* CUSTOM USER PINPOINT MARKER */}
        {pinned && (
          <React.Fragment key={`pinned-${pinned.lat}-${pinned.lng}`}>
            <Marker position={[pinned.lat, pinned.lng]} icon={pinpointIcon}>
              <Popup className="custom-popup" autoPan={false}>
                <div className="p-2 min-w-44 text-xs text-[#0F2742] space-y-1">
                  <div className="font-extrabold text-sm text-[#0F2742] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{pinned.placeName}</span>
                  </div>
                  <div className="text-[10px] text-[#5D7188] font-mono-stat">
                    {pinned.lat.toFixed(4)}°N, {pinned.lng.toFixed(4)}°E
                  </div>
                  {pinned.current && (
                    <div className="font-bold text-[#1557B0] text-xs pt-1">
                      {pinned.current.temperature_c}°C • {pinned.current.condition || 'Current'}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* Pulsing Visual Influence Radius */}
            <Circle
              center={[pinned.lat, pinned.lng]}
              radius={30000}
              pathOptions={{
                color: '#F59E0B',
                fillColor: '#F59E0B',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '4, 8',
              }}
            />
          </React.Fragment>
        )}
      </MapContainer>
    </div>
  );
};
