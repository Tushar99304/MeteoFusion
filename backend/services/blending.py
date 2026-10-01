"""
blending.py - Multi-Model Forecast Blending Engine
"""
from __future__ import annotations

import os
from typing import List, Dict, Any, Optional, Tuple
from backend.models import (
    ModelForecast,
    BlendedForecastMetadata,
    CalibrationMetadata,
    AdaptiveWeightAudit,
    LeadTimeCalibrationResult,
)
from backend.services.calibration import HistoricalSkillCalibrator
from backend.services.adaptive_weights import AdaptiveWeightEngine


class ModelBlendingEngine:
    """
    Adaptive AI-NWP Multi-Model Forecast Blending System (SIH26081).

    Production pipeline flow:
    forecast retrieval → determine lead time → select calibrated profile (+24h, +48h, +72h)
    → apply region/variable calibration → availability masking → exact normalization → blended forecast
    """

    def __init__(self, calibration_path: Optional[str] = None):
        self.calibration_path = calibration_path
        self.adaptive_engine = AdaptiveWeightEngine()

    def determine_weather_regime(self, models: List[ModelForecast]) -> str:
        """Determines weather regime from model consensus."""
        max_precip = max((m.precipitation_mm for m in models if m.precipitation_mm is not None), default=0.0)
        max_wind = max((m.wind_speed_kmh for m in models if m.wind_speed_kmh is not None), default=0.0)
        max_temp = max((m.temperature_c for m in models if m.temperature_c is not None), default=0.0)

        if max_precip > 15:
            return "Heavy Rain"
        elif max_wind > 40:
            return "High Wind"
        elif max_temp > 38:
            return "Heat"
        return "Normal"

    def calculate_weights(
        self,
        models: List[ModelForecast],
        regime: str,
        region: str,
        lead_time_hours: Optional[int | float] = None,
        variable: str = "temperature",
    ) -> Tuple[Optional[CalibrationMetadata], AdaptiveWeightAudit]:
        """
        Assigns weights to models using the AdaptiveWeightEngine.
        - Resolves lead time to nearest calibrated horizon (+24h, +48h, +72h).
        - Selects authoritative verified weights from calibration_leadtimes.json.
        - If calibration is unavailable or outside scope, falls back to uncalibrated baseline.
        - Missing models receive weight 0.0, and remaining models renormalize to sum to exactly 1.0.
        """
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        leadtimes_file = os.path.join(root_dir, "calibration_leadtimes.json")
        calib_90d_file = os.path.join(root_dir, "calibration_90d.json")
        calib_30d_file = os.path.join(root_dir, "calibration.json")

        lead_time_result: Optional[LeadTimeCalibrationResult] = None
        calibration_meta: Optional[CalibrationMetadata] = None

        if self.calibration_path:
            # Explicit path specified (e.g. in test fixture)
            lead_time_result = HistoricalSkillCalibrator.load_lead_time_calibration(self.calibration_path)
            if not lead_time_result:
                calibration_meta = HistoricalSkillCalibrator.load_calibration(self.calibration_path)
        else:
            # Production resolution: prefer calibration_leadtimes.json (multi-lead 90-day)
            if os.path.isfile(leadtimes_file):
                lead_time_result = HistoricalSkillCalibrator.load_lead_time_calibration(leadtimes_file)
            elif os.path.isfile(calib_90d_file):
                calibration_meta = HistoricalSkillCalibrator.load_calibration(calib_90d_file)
            else:
                calibration_meta = HistoricalSkillCalibrator.load_calibration(calib_30d_file)

        lt_h = lead_time_hours if lead_time_hours is not None else 24
        bucket = self.adaptive_engine.resolve_lead_time_bucket(lt_h)

        # Build active CalibrationMetadata matching the selected lead time profile
        if lead_time_result and bucket and bucket in lead_time_result.lead_times:
            profile = lead_time_result.lead_times[bucket]
            calibration_meta = CalibrationMetadata(
                calibrated_at=lead_time_result.calibrated_at,
                evaluation_period=lead_time_result.evaluation_period,
                lead_time=profile.lead_time,
                location=lead_time_result.location,
                latitude=lead_time_result.latitude,
                longitude=lead_time_result.longitude,
                reference_dataset=lead_time_result.reference_dataset,
                metric=lead_time_result.metric,
                sample_counts=profile.sample_counts,
                mae=profile.mae,
                rmse=profile.rmse,
                weights=profile.weights,
                epsilon=lead_time_result.epsilon,
                weighting_scheme=lead_time_result.weighting_scheme,
                total_eval_samples=profile.total_eval_samples or 2160,
                is_valid=profile.is_valid,
            )

        all_models = [m.model_name for m in models]
        valid_models = [
            m.model_name
            for m in models
            if (m.temperature_c is not None or m.precipitation_mm is not None or m.wind_speed_kmh is not None)
        ]

        final_weights, audit = self.adaptive_engine.compute_weights(
            region=region,
            lead_time_hours=lt_h,
            weather_regime=regime,
            variable=variable,
            available_models=valid_models,
            all_models=all_models,
            calibration_metadata=calibration_meta,
            lead_time_result=lead_time_result,
        )

        for m in models:
            m.weight = final_weights.get(m.model_name, 0.0)

        calib_return = calibration_meta if audit.calibration_status == "CALIBRATED" else None
        return calib_return, audit


    def blend_forecasts(
        self,
        models: List[ModelForecast],
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        location_name: Optional[str] = None,
        region: Optional[str] = None,
        lead_time_hours: int = 24,
        target_time: Optional[str] = None,
        variable: str = "temperature",
        weather_regime: Optional[str] = None,
    ) -> BlendedForecastMetadata:
        effective_region = region or location_name or (f"{lat}, {lon}" if lat is not None and lon is not None else "Mumbai")
        regime = weather_regime or self.determine_weather_regime(models)

        calibration_meta, audit = self.calculate_weights(
            models,
            regime=regime,
            region=effective_region,
            lead_time_hours=lead_time_hours,
            variable=variable,
        )

        blended_temp = 0.0
        blended_precip = 0.0
        blended_wind = 0.0

        weight_temp = 0.0
        weight_precip = 0.0
        weight_wind = 0.0

        for m in models:
            # We never treat missing values as zero. Only accumulate if value is present.
            if m.temperature_c is not None and m.weight > 0:
                blended_temp += m.temperature_c * m.weight
                weight_temp += m.weight
            if m.precipitation_mm is not None and m.weight > 0:
                blended_precip += m.precipitation_mm * m.weight
                weight_precip += m.weight
            if m.wind_speed_kmh is not None and m.weight > 0:
                blended_wind += m.wind_speed_kmh * m.weight
                weight_wind += m.weight

        indicators = []
        if regime != "Normal":
            indicators.append(f"Regime identified ({regime})")

        return BlendedForecastMetadata(
            region=effective_region,
            season="Monsoon/Post-Monsoon",
            weather_regime=regime,
            lead_time_hours=lead_time_hours,
            target_time=target_time,
            models=models,
            extreme_weather_indicators=indicators,
            blended_temperature_c=round(blended_temp / weight_temp, 1) if weight_temp > 0 else None,
            blended_precipitation_mm=round(blended_precip / weight_precip, 1) if weight_precip > 0 else None,
            blended_wind_speed_kmh=round(blended_wind / weight_wind, 1) if weight_wind > 0 else None,
            calibration_mode=audit.calibration_status,
            calibration_metadata=calibration_meta,
            adaptive_audit=audit,
        )

    def blend(
        self,
        model_inputs: List[ModelForecast],
        region: str,
        lead_time_hours: int = 6,
        target_time: Optional[str] = None,
        variable: str = "temperature",
    ) -> BlendedForecastMetadata:
        return self.blend_forecasts(
            models=model_inputs,
            region=region,
            lead_time_hours=lead_time_hours,
            target_time=target_time,
            variable=variable,
        )

