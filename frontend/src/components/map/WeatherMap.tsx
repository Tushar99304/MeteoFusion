import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { fetchOverview } from '../../services/backendClient';
import type { BackendOverviewPlace } from '../../types/backend';
import { SourceBadge } from '../common/SourceBadge';
import { Layers, CloudRain, Thermometer, Wind, ShieldAlert, Loader2, CloudOff, FlaskConical } from 'lucide-react';
import L from 'leaflet';
import { useWeatherStore } from '../../store/useWeatherStore';

// Leaflet icon fix for Vite/React
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type LayerKind = 'rain' | 'temp' | 'wind' | 'alerts';

/**
 * Map data comes from the read-only GET /api/overview (current conditions per city from the
 * configured weather provider). Radar/temperature/wind TILE layers do not exist in this build,
 * so the layer buttons only recolour markers honestly; the alerts layer reflects the ACTIVE
 * alerts in the store (real SACHET alerts), never fabricated "warning zones".
 */
export const WeatherMap: React.FC = () => {
  const { alerts, usingSample } = useWeatherStore();
  const [activeLayer, setActiveLayer] = useState<LayerKind>('rain');
  const [places, setPlaces] = useState<BackendOverviewPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
      return hasAlert ? '#D9534F' : '#6BAF92';
    }
    const cur = p.current;
    if (activeLayer === 'temp' && cur?.temperature_c != null) {
      return cur.temperature_c >= 35 ? '#D9534F' : cur.temperature_c >= 28 ? '#F4B942' : '#2E7D5B';
    }
    if (activeLayer === 'wind' && cur?.wind_speed_kmh != null) {
      return cur.wind_speed_kmh >= 40 ? '#D9534F' : cur.wind_speed_kmh >= 25 ? '#F4B942' : '#4F8FC0';
    }
    // rain
    if (cur?.precipitation_mm != null) {
      return cur.precipitation_mm >= 7.5 ? '#D9534F' : cur.precipitation_mm > 0 ? '#4F8FC0' : '#6BAF92';
    }
    return '#6BAF92';
  };

  const layerButton = (id: LayerKind, label: string, Icon: React.ElementType, alert = false) => (
    <button
      onClick={() => setActiveLayer(id)}
      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
        activeLayer === id
          ? alert
            ? 'bg-red-600 text-white shadow-xs'
            : 'bg-[#2E7D5B] text-white shadow-xs'
          : 'bg-white text-[#17352A] border border-[#DCEAE2] hover:bg-[#E8F5EE]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="relative w-full h-[calc(100vh-9.5rem)] rounded-2xl overflow-hidden border border-[#DCEAE2] shadow-xs">
      <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md border border-[#DCEAE2] p-2 rounded-xl shadow-md flex flex-wrap gap-2 max-w-[90%]">
        <div className="text-xs font-bold text-[#17352A] flex items-center gap-1.5 px-2">
          <Layers className="w-4 h-4 text-[#2E7D5B]" />
          <span>Layers:</span>
        </div>
        {layerButton('rain', 'Rainfall (current)', CloudRain)}
        {layerButton('temp', 'Temperature', Thermometer)}
        {layerButton('wind', 'Wind', Wind)}
        {layerButton('alerts', 'Official alerts', ShieldAlert, true)}
      </div>

      <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-md border border-[#DCEAE2] p-3 rounded-xl shadow-md text-xs space-y-1.5 max-w-[220px]">
        <div className="font-bold text-[#17352A] text-[11px] uppercase tracking-wider">
          {activeLayer === 'rain' && 'Current rain (mm)'}
          {activeLayer === 'temp' && 'Current temperature (°C)'}
          {activeLayer === 'wind' && 'Current wind (km/h)'}
          {activeLayer === 'alerts' && 'Official alert zones'}
        </div>
        <p className="text-[10px] text-[#6B7D74]">
          Station observations from Open-Meteo ({usingSample ? 'sample' : 'research/repro'}). No
          radar/satellite tile layer is wired in this build, so circles are observation markers —
          not radar.
        </p>
      </div>

      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-[#DCEAE2] rounded-xl px-4 py-3 text-xs text-[#2E7D5B] font-semibold flex items-center gap-2 shadow-md">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading live observations…
        </div>
      )}
      {!loading && error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-semibold flex items-center gap-2 shadow-md max-w-xs text-center">
          <CloudOff className="w-5 h-5" /> Live observations unavailable ({error}). Markers are
          hidden rather than faked.
        </div>
      )}
      {usingSample && (
        <div className="absolute top-20 left-4 z-[1000] bg-amber-100 text-amber-900 border border-amber-300 rounded-lg px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> SAMPLE DATA MODE
        </div>
      )}

      <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={true} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {places.map((p) => {
          const color = colorFor(p);
          return (
            <React.Fragment key={p.name}>
              <Marker position={[p.lat, p.lng]} icon={customIcon}>
                <Popup className="custom-popup">
                  <div className="p-1 space-y-2 min-w-48 text-xs text-[#17352A]">
                    <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-1.5">
                      <strong className="font-bold text-sm text-[#17352A]">{p.name}</strong>
                      <SourceBadge source="Open-Meteo" authority="research_repro" size="sm" />
                    </div>
                    {p.current ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>Temp: <strong>{p.current.temperature_c ?? '—'}°C</strong></div>
                        <div>Rain: <strong>{p.current.precipitation_mm ?? '—'} mm</strong></div>
                        <div>Wind: <strong>{p.current.wind_speed_kmh ?? '—'} km/h</strong></div>
                        <div>Humidity: <strong>{p.current.humidity_pct ?? '—'}%</strong></div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#6B7D74]">No live observation available.</p>
                    )}
                    <div className="text-[10px] text-[#6B7D74] pt-1">
                      {p.current?.condition || 'Current conditions'} · {p.retrieved_at_utc || ''}
                    </div>
                  </div>
                </Popup>
              </Marker>

              <Circle
                center={[p.lat, p.lng]}
                radius={55000}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.18 }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};
