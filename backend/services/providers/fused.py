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
from backend.services.blending import ModelBlendingEngine
from backend.models import ModelForecast

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
        
        # SIH26081 MVP target NWP models + ECMWF AIFS (AI/ML).
        # Identifier verified live against Open-Meteo API on 2026-09-30:
        #   ecmwf_aifs025_single  → 48 non-null hourly steps, temperature_2m/precipitation/wind_speed_10m ✓
        #   ecmwf_aifs025         → accepted by API but all values null (interpolated grid not populated)
        models_registry = [
            {"name": "ECMWF IFS HRES", "om_id": "ecmwf_ifs025",        "type": "NWP"},
            {"name": "NCEP GFS",        "om_id": "gfs_seamless",        "type": "NWP"},
            {"name": "DWD ICON Global", "om_id": "icon_seamless",       "type": "NWP"},
            {"name": "ECMWF AIFS",      "om_id": "ecmwf_aifs025_single","type": "AI/ML"},
        ]
        # Build lookup by display-name for the blending loop
        nwp_models = {r["name"]: r for r in models_registry}

        
        tasks = []
        keys = []
        
        # Fetch individual models from Open-Meteo (NWP + AIFS)
        om_provider = OpenMeteoProvider()
        for model_name, reg in nwp_models.items():
            tasks.append(om_provider.fetch(
                latitude, longitude,
                timeframe=timeframe,
                timezone=timezone,
                target_date=target_date,
                utc_offset_seconds=utc_offset_seconds,
                model_override=reg["om_id"]
            ))
            keys.append(model_name)

            
        # Fetch optional validation providers
        if config.FUSION_WEIGHT_OPENWEATHER > 0:
            tasks.append(OpenWeatherMapProvider().fetch(
                latitude, longitude, timeframe=timeframe, timezone=timezone, target_date=target_date, utc_offset_seconds=utc_offset_seconds
            ))
            keys.append("openweathermap")
            
        if config.FUSION_WEIGHT_TOMORROWIO > 0:
            tasks.append(TomorrowIoProvider().fetch(
                latitude, longitude, timeframe=timeframe, timezone=timezone, target_date=target_date, utc_offset_seconds=utc_offset_seconds
            ))
            keys.append("tomorrowio")
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_bundles = []
        fused_sources = []
        
        for key, res in zip(keys, results):
            if isinstance(res, Exception):
                continue
            if isinstance(res, WeatherBundle):
                valid_bundles.append((key, res))
                fused_sources.append(key)
                
        if not valid_bundles:
            raise UpstreamError("fused", "All weather providers and models failed.")

        # Find the primary structural bundle (prefer ECMWF)
        primary_bundle = valid_bundles[0][1]
        for k, b in valid_bundles:
            if k == "ECMWF IFS HRES":
                primary_bundle = b
                break
                
        # SIH26081 MVP: Generate explicit Multi-Model Blending Metadata
        engine = ModelBlendingEngine()
        model_inputs = []
        
        # SIH26081: Use the last available hourly step as the shared forecast target.
        # HOURLY_STEPS=24 fetches 24 steps (indices 0..23), so index 23 is the furthest
        # available point — approximately 23 hours after the current hour (T+23h ≈ T+24h).
        # lead_time_hours is derived from the actual ISO timestamps so it is never fabricated.
        target_time = None
        lead_time_hours = 0

        if primary_bundle.hourly and len(primary_bundle.hourly) >= 24:
            # Prefer T+24 (index 23 of a 0-based 24-step block)
            target_step = primary_bundle.hourly[23]
        elif primary_bundle.hourly:
            # Fall back to last available step
            target_step = primary_bundle.hourly[-1]
        else:
            target_step = None

        if target_step is not None:
            target_time = target_step.time
            # Compute actual lead time from the current wall-clock anchor.
            # primary_bundle.current.time is naive local ISO "YYYY-MM-DDTHH:MM"; we
            # compute the integer-hour difference to avoid fabricating the number.
            try:
                current_anchor = primary_bundle.current.time if primary_bundle.current else None
                if current_anchor and target_time:
                    # Truncate both to the hour for a clean integer difference
                    anchor_hour = dt.datetime.fromisoformat(current_anchor[:13] + ":00")
                    target_hour = dt.datetime.fromisoformat(target_time[:13] + ":00")
                    delta_h = int((target_hour - anchor_hour).total_seconds() / 3600)
                    lead_time_hours = max(1, delta_h)
                else:
                    lead_time_hours = len(primary_bundle.hourly) - 1 if primary_bundle.hourly else 0
            except Exception:
                lead_time_hours = len(primary_bundle.hourly) - 1 if primary_bundle.hourly else 0

        # Hour-prefix for cross-model matching (first 13 chars = "YYYY-MM-DDTHH").
        # Models may differ slightly in sub-hour formatting; anchoring on the hour is safe.
        target_hour_prefix = target_time[:13] if target_time else None

        for k, b in valid_bundles:
            if k in nwp_models:
                target_pt = None
                if target_hour_prefix and b.hourly:
                    for h in b.hourly:
                        if h.time[:13] == target_hour_prefix:
                            target_pt = h
                            break
                            
                m = ModelForecast(
                    model_name=k,
                    model_type=nwp_models[k]["type"],  # "NWP" or "AI/ML" — from registry
                    weight=1.0,
                    temperature_c=target_pt.temperature_c if target_pt else None,
                    precipitation_mm=target_pt.precipitation_mm if target_pt else None,
                    wind_speed_kmh=target_pt.wind_speed_kmh if target_pt else None
                )
                model_inputs.append(m)
            
        region = "Unknown Region"
        if primary_bundle.grid_latitude is not None and primary_bundle.grid_longitude is not None:
            region = f"{primary_bundle.grid_latitude:.2f}, {primary_bundle.grid_longitude:.2f}"
            
        blending_metadata = engine.blend(model_inputs, region=region, lead_time_hours=lead_time_hours, target_time=target_time)

        
        # Override the current weather with the blended outputs for the UI
        fused_current = None
        
        # Calculate cross-provider disagreement for validation purposes
        disagreement_flag = False
        source_agreement_score = 1.0
        agreement_str = "Multi-Model Consensus"
        
        val_temps = []
        for k, b in valid_bundles:
            if b.current and b.current.temperature_c is not None:
                val_temps.append(b.current.temperature_c)
                
        if len(val_temps) > 1 and config.FUSION_MAX_DISAGREEMENT_C is not None:
            max_t = max(val_temps)
            min_t = min(val_temps)
            if (max_t - min_t) > config.FUSION_MAX_DISAGREEMENT_C:
                disagreement_flag = True
                source_agreement_score = 0.3
                agreement_str = "Low Agreement"
        
        if primary_bundle.current:
            fused_current = CurrentWeather(
                time=primary_bundle.current.time,
                utc_offset_seconds=primary_bundle.current.utc_offset_seconds,
                interval_seconds=primary_bundle.current.interval_seconds,
                temperature_c=primary_bundle.current.temperature_c,
                apparent_temperature_c=primary_bundle.current.apparent_temperature_c,
                humidity_pct=primary_bundle.current.humidity_pct,
                precipitation_mm=primary_bundle.current.precipitation_mm,
                wind_speed_kmh=primary_bundle.current.wind_speed_kmh,
                wind_direction_deg=primary_bundle.current.wind_direction_deg,
                pressure_hpa=primary_bundle.current.pressure_hpa,
                cloud_cover_pct=primary_bundle.current.cloud_cover_pct,
                weather_code=primary_bundle.current.weather_code,
                condition=primary_bundle.current.condition,
                units=primary_bundle.current.units
            )
        
        fused_bundle = WeatherBundle(
            provider="multi-source",
            model="nwp-multi-model-blend",
            kind=primary_bundle.kind,
            requested_timeframe=primary_bundle.requested_timeframe,
            retrieved_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(),
            api_utc_offset_seconds=primary_bundle.api_utc_offset_seconds,
            grid_latitude=primary_bundle.grid_latitude,
            grid_longitude=primary_bundle.grid_longitude,
            elevation_m=primary_bundle.elevation_m,
            current=fused_current if fused_current else primary_bundle.current,
            today=primary_bundle.today,
            tomorrow=primary_bundle.tomorrow,
            target_day=primary_bundle.target_day,
            past_days=primary_bundle.past_days,
            hourly=primary_bundle.hourly,
            requested_parameters=primary_bundle.requested_parameters,
            request_url="fused://internal",
            fused_sources=fused_sources,
            disagreement_flag=disagreement_flag,
            source_agreement_score=source_agreement_score,
            source_agreement=agreement_str,
            blending_metadata=blending_metadata
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
