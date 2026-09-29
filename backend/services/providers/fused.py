"""
fused.py - Multi-source validation and weighted forecast fusion.
"""
from __future__ import annotations
import asyncio
import datetime as dt
from typing import Optional, List, Dict, Any, Tuple

from backend import config
from backend.models import WeatherBundle, CurrentWeather, ForecastDay, HourlyForecastPoint
from backend.services.http_client import UpstreamError
from backend.services.weather import OpenMeteoProvider
from backend.services.providers.openweathermap import OpenWeatherMapProvider
from backend.services.providers.tomorrowio import TomorrowIoProvider

class FusedWeatherProvider:
    name = "multi-source"

    def __init__(self):
        self.providers = {
            "open-meteo": (OpenMeteoProvider(), config.FUSION_WEIGHT_OPEN_METEO),
            "openweathermap": (OpenWeatherMapProvider(), config.FUSION_WEIGHT_OPENWEATHER),
            "tomorrowio": (TomorrowIoProvider(), config.FUSION_WEIGHT_TOMORROWIO)
        }

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
        
        tasks = []
        keys = []
        for key, (prov, weight) in self.providers.items():
            if weight > 0:
                tasks.append(prov.fetch(
                    latitude, longitude,
                    timeframe=timeframe,
                    timezone=timezone,
                    target_date=target_date,
                    utc_offset_seconds=utc_offset_seconds
                ))
                keys.append(key)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_bundles = []
        fused_sources = []
        
        for key, res in zip(keys, results):
            if isinstance(res, Exception):
                continue
            if isinstance(res, WeatherBundle):
                valid_bundles.append((key, res, self.providers[key][1]))
                fused_sources.append(key)
                
        if not valid_bundles:
            raise UpstreamError("fused", "All weather providers failed.")

        if len(valid_bundles) == 1:
            key, bundle, w = valid_bundles[0]
            bundle.provider = "multi-source"
            bundle.fused_sources = fused_sources
            bundle.source_agreement_score = None
            bundle.source_agreement = "Single-source / limited evidence"
            bundle.disagreement_flag = False
            return bundle

        # Prepare for fusion
        primary_bundle = valid_bundles[0][1] # Fallback for structural elements
        for k, b, w in valid_bundles:
            # We prefer Open-Meteo as the structural primary if it succeeded
            if k == "open-meteo":
                primary_bundle = b
                
        fused_current, cur_disagree, cur_conf = self._fuse_current([b for k, b, w in valid_bundles], [w for k, b, w in valid_bundles])
        
        fused_today = self._fuse_forecast_day([b.today for k, b, w in valid_bundles if b.today], [w for k, b, w in valid_bundles if b.today]) if primary_bundle.today else None
        fused_tomorrow = self._fuse_forecast_day([b.tomorrow for k, b, w in valid_bundles if b.tomorrow], [w for k, b, w in valid_bundles if b.tomorrow]) if primary_bundle.tomorrow else None
        fused_target = self._fuse_forecast_day([b.target_day for k, b, w in valid_bundles if b.target_day], [w for k, b, w in valid_bundles if b.target_day]) if primary_bundle.target_day else None
        
        disagreement_flag = cur_disagree
        
        if len(valid_bundles) == 2:
            if cur_disagree:
                agreement_str = "Low Agreement"
            else:
                agreement_str = "Moderate/High Agreement"
        else:
            if cur_conf >= 1.0:
                agreement_str = "High Agreement"
            elif cur_conf >= 0.7:
                agreement_str = "Moderate Agreement"
            else:
                agreement_str = "Low Agreement"
        
        fused_bundle = WeatherBundle(
            provider="multi-source",
            model="weighted-fusion",
            kind=primary_bundle.kind,
            requested_timeframe=primary_bundle.requested_timeframe,
            retrieved_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(),
            api_utc_offset_seconds=primary_bundle.api_utc_offset_seconds,
            grid_latitude=primary_bundle.grid_latitude,
            grid_longitude=primary_bundle.grid_longitude,
            elevation_m=primary_bundle.elevation_m,
            current=fused_current if fused_current else primary_bundle.current,
            today=fused_today if fused_today else primary_bundle.today,
            tomorrow=fused_tomorrow if fused_tomorrow else primary_bundle.tomorrow,
            target_day=fused_target if fused_target else primary_bundle.target_day,
            past_days=primary_bundle.past_days,
            hourly=primary_bundle.hourly,
            requested_parameters=primary_bundle.requested_parameters,
            request_url="fused://internal",
            fused_sources=fused_sources,
            disagreement_flag=disagreement_flag,
            source_agreement_score=cur_conf,
            source_agreement=agreement_str
        )
        return fused_bundle

    def _fuse_numeric_field(self, values: List[Optional[float]], weights: List[float], max_diff: Optional[float] = None) -> Tuple[Optional[float], bool, float]:
        vals = []
        for v, w in zip(values, weights):
            if v is not None:
                vals.append((v, w))
                
        if not vals:
            return None, False, 1.0
            
        if len(vals) == 1:
            return vals[0][0], False, 1.0
            
        disagreement = False
        confidence = 1.0
        just_vals = [v for v, w in vals]
        
        if max_diff is not None:
            max_v = max(just_vals)
            min_v = min(just_vals)
            if (max_v - min_v) > max_diff:
                disagreement = True
                
                if len(vals) == 3:
                    v1, v2, v3 = just_vals
                    d12 = abs(v1 - v2)
                    d23 = abs(v2 - v3)
                    d13 = abs(v1 - v3)
                    
                    num_high_diff = sum(1 for d in [d12, d23, d13] if d > max_diff)
                    if num_high_diff == 2:
                        if d12 <= max_diff: outlier_idx = 2
                        elif d23 <= max_diff: outlier_idx = 0
                        else: outlier_idx = 1
                        
                        vals = [vals[i] for i in range(3) if i != outlier_idx]
                        confidence = 0.7
                    else:
                        confidence = 0.3
                else:
                    confidence = 0.5
                    
        total_val = sum(v * w for v, w in vals)
        total_w = sum(w for _, w in vals)
        return total_val / total_w if total_w > 0 else None, disagreement, confidence

    def _fuse_current(self, bundles: List[WeatherBundle], weights: List[float]) -> Tuple[Optional[CurrentWeather], bool, float]:
        currents = []
        cur_weights = []
        for b, w in zip(bundles, weights):
            if b.current:
                currents.append(b.current)
                cur_weights.append(w)
                
        if not currents:
            return None, False, 1.0
            
        temp_c, dis_t, conf_t = self._fuse_numeric_field([c.temperature_c for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_C)
        app_temp_c, _, _ = self._fuse_numeric_field([c.apparent_temperature_c for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_C)
        hum_pct, _, _ = self._fuse_numeric_field([c.humidity_pct for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_HUMIDITY_PCT)
        precip_mm, dis_p, conf_p = self._fuse_numeric_field([c.precipitation_mm for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_PRECIP_MM)
        wind_kmh, _, _ = self._fuse_numeric_field([c.wind_speed_kmh for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_WIND_KMH)
        pressure, _, _ = self._fuse_numeric_field([c.pressure_hpa for c in currents], cur_weights, config.FUSION_MAX_DISAGREEMENT_PRESSURE_HPA)
        cloud_pct, _, _ = self._fuse_numeric_field([c.cloud_cover_pct for c in currents], cur_weights)
        
        primary = currents[0]
        
        fused = CurrentWeather(
            time=primary.time,
            utc_offset_seconds=primary.utc_offset_seconds,
            interval_seconds=primary.interval_seconds,
            temperature_c=temp_c if temp_c is not None else primary.temperature_c,
            apparent_temperature_c=app_temp_c if app_temp_c is not None else primary.apparent_temperature_c,
            humidity_pct=hum_pct if hum_pct is not None else primary.humidity_pct,
            precipitation_mm=precip_mm if precip_mm is not None else primary.precipitation_mm,
            wind_speed_kmh=wind_kmh if wind_kmh is not None else primary.wind_speed_kmh,
            wind_direction_deg=primary.wind_direction_deg,
            pressure_hpa=pressure if pressure is not None else primary.pressure_hpa,
            cloud_cover_pct=cloud_pct if cloud_pct is not None else primary.cloud_cover_pct,
            weather_code=primary.weather_code,
            condition=primary.condition,
            units=primary.units
        )
        
        overall_disagree = dis_t or dis_p
        overall_conf = min(conf_t, conf_p)
        return fused, overall_disagree, overall_conf

    def _fuse_forecast_day(self, days: List[ForecastDay], weights: List[float]) -> Optional[ForecastDay]:
        if not days:
            return None
            
        t_max, _, _ = self._fuse_numeric_field([d.temperature_max_c for d in days], weights)
        t_min, _, _ = self._fuse_numeric_field([d.temperature_min_c for d in days], weights)
        precip, _, _ = self._fuse_numeric_field([d.precipitation_sum_mm for d in days], weights)
        prob, _, _ = self._fuse_numeric_field([d.precipitation_probability_max_pct for d in days], weights)
        wind_max, _, _ = self._fuse_numeric_field([d.wind_speed_max_kmh for d in days], weights)
        
        primary = days[0]
        return ForecastDay(
            date=primary.date,
            label=primary.label,
            is_forecast=primary.is_forecast,
            temperature_max_c=t_max if t_max is not None else primary.temperature_max_c,
            temperature_min_c=t_min if t_min is not None else primary.temperature_min_c,
            precipitation_sum_mm=precip if precip is not None else primary.precipitation_sum_mm,
            precipitation_probability_max_pct=prob if prob is not None else primary.precipitation_probability_max_pct,
            wind_speed_max_kmh=wind_max if wind_max is not None else primary.wind_speed_max_kmh,
            weather_code=primary.weather_code,
            condition=primary.condition,
            units=primary.units
        )
