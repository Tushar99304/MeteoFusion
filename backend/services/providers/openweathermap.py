"""
openweathermap.py - OpenWeatherMap provider.
"""
from __future__ import annotations
import datetime as dt
from typing import Optional

from backend import config
from backend.models import WeatherBundle, CurrentWeather, ForecastDay
from backend.services.http_client import get_json, UpstreamError

class OpenWeatherMapProvider:
    name = "OpenWeatherMap"

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
        if not config.OPENWEATHERMAP_API_KEY:
            raise UpstreamError("openweathermap", "API key not configured")
        
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={latitude}&lon={longitude}&appid={config.OPENWEATHERMAP_API_KEY}&units=metric"
        
        try:
            res = await get_json(url, service="openweathermap")
        except Exception as e:
            raise UpstreamError("openweathermap", str(e))
            
        retrieved_at = dt.datetime.now(dt.timezone.utc).isoformat()
        
        current = CurrentWeather(
            time=dt.datetime.fromtimestamp(res["dt"], tz=dt.timezone.utc).isoformat(),
            temperature_c=res["main"].get("temp"),
            apparent_temperature_c=res["main"].get("feels_like"),
            humidity_pct=res["main"].get("humidity"),
            pressure_hpa=res["main"].get("pressure"),
            wind_speed_kmh=res["wind"].get("speed", 0) * 3.6, # m/s to km/h
            condition=res["weather"][0]["description"].title() if res.get("weather") else None
        )
        
        bundle = WeatherBundle(
            provider="openweathermap",
            model="openweathermap",
            kind="live",
            requested_timeframe=timeframe,
            retrieved_at_utc=retrieved_at,
            api_utc_offset_seconds=res.get("timezone", 0),
            current=current,
            request_url=url.replace(config.OPENWEATHERMAP_API_KEY, "REDACTED")
        )
        return bundle
