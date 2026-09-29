"""
tomorrowio.py - Tomorrow.io provider.
"""
from __future__ import annotations
import datetime as dt
from typing import Optional

from backend import config
from backend.models import WeatherBundle, CurrentWeather, ForecastDay
from backend.services.http_client import get_json, UpstreamError

class TomorrowIoProvider:
    name = "Tomorrow.io"

    async def fetch(
        self,
        latitude: float,
        longitude: float,
        *,
        timeframe: str = "now",
        timezone: Optional[str] = None,
        target_date: Optional[str] = None,
        utc_offset_seconds: Optional[int] = None,
    ) -> WeatherBundle:
        if not config.TOMORROW_IO_API_KEY:
            raise UpstreamError("tomorrowio", "API key not configured")
        
        url = f"https://api.tomorrow.io/v4/weather/realtime?location={latitude},{longitude}&apikey={config.TOMORROW_IO_API_KEY}"
        
        try:
            res = await get_json(url, service="tomorrowio")
        except Exception as e:
            raise UpstreamError("tomorrowio", str(e))
            
        retrieved_at = dt.datetime.now(dt.timezone.utc).isoformat()
        
        vals = res.get("data", {}).get("values", {})
        
        current = CurrentWeather(
            time=res.get("data", {}).get("time", retrieved_at),
            temperature_c=vals.get("temperature"),
            apparent_temperature_c=vals.get("temperatureApparent"),
            humidity_pct=vals.get("humidity"),
            pressure_hpa=vals.get("pressureSurfaceLevel"),
            wind_speed_kmh=vals.get("windSpeed", 0) * 3.6, # m/s to km/h
            precipitation_mm=vals.get("precipitationIntensity"),
            cloud_cover_pct=vals.get("cloudCover")
        )
        
        bundle = WeatherBundle(
            provider="tomorrowio",
            model="tomorrowio",
            kind="live",
            requested_timeframe=timeframe,
            retrieved_at_utc=retrieved_at,
            current=current,
            request_url=url.replace(config.TOMORROW_IO_API_KEY, "REDACTED")
        )
        return bundle
