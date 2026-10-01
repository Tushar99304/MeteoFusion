"""
adaptive_weights.py — Adaptive Weight Engine for Hybrid AI–NWP Forecast Blending (SIH26081).

Target Concept:
    Historical skill + Lead time + Region + Weather regime = adaptive model weights

Core Invariants:
1. NON-NEGATIVE & NORMALIZED:
   All model weights are >= 0.0 and sum to exactly 1.0 across available models.
2. MISSING MODEL EXCLUSION:
   An unavailable model (null prediction or missing) receives weight 0.0.
   Remaining model weights are renormalized to preserve their relative skill ratios.
3. EMPIRICAL TRUTH & ZERO FABRICATION:
   The current Mumbai +24h temperature calibration (ERA5 30-day inverse-MAE) is the
   authoritative real empirical profile.
   For dimensions without validated empirical calibration data (e.g., weather regime,
   unsupported regions or lead times), DO NOT invent values or apply arbitrary heuristic
   adjustments. Retain base weights, explicitly record the dimension in fallback_dimensions,
   and expose this in the audit metadata.
4. AUDIT TRANSPARENCY:
   Every blending decision produces a full audit structure recording base weights,
   adjustments, final weights, calibrated dimensions, and fallback dimensions.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Any, Tuple
from backend.models import (
    AdaptiveWeightAudit,
    CalibrationMetadata,
    LeadTimeCalibrationProfile,
    LeadTimeCalibrationResult,
)

logger = logging.getLogger("meteofusion.adaptive_weights")

# Canonical explanation string for the Adaptive Weight Engine
ADAPTIVE_EXPLANATION = (
    "Final weights are derived from historical model skill and contextual calibration "
    "where validated data is available."
)

# Standard target NWP and AI/ML model keys
DEFAULT_MODELS = [
    "ECMWF IFS HRES",
    "NCEP GFS",
    "DWD ICON Global",
    "ECMWF AIFS",
]


class AdaptiveWeightEngine:
    """
    Computes adaptive, normalized multi-model blending weights combining:
    - Base historical skill weights (inverse-MAE calibration)
    - Contextual dimensions: Region, Lead Time, Variable, Weather Regime
    """

    @staticmethod
    def resolve_lead_time_bucket(lead_time_hours: Optional[float | int]) -> Optional[str]:
        """
        Resolves the nearest supported calibrated lead-time bucket (+24h, +48h, +72h).
        Operational Horizons:
        - Around +24h [12h, 36h): returns '24h'
        - Around +48h [36h, 60h): returns '48h'
        - Around +72h [60h, 84h]: returns '72h'
        - Outside [12h, 84h] or None: returns None (triggers safe fallback)
        """
        if lead_time_hours is None:
            return None
        try:
            lt = float(lead_time_hours)
        except (ValueError, TypeError):
            return None
        if 12.0 <= lt < 36.0:
            return "24h"
        elif 36.0 <= lt < 60.0:
            return "48h"
        elif 60.0 <= lt <= 84.0:
            return "72h"
        return None

    @staticmethod
    def is_region_calibrated(region: str, calib_meta: Optional[CalibrationMetadata] = None) -> bool:
        """
        Validates if empirical historical calibration exists for the given region.
        Currently calibrated for: Mumbai (coordinates ~19.08°N, 72.88°E or named match).
        """
        if not region:
            return False
        r_lower = region.lower().strip()
        if "mumbai" in r_lower or "bombay" in r_lower:
            return True
        try:
            parts = [float(p.strip()) for p in region.split(",") if p.strip()]
            if len(parts) == 2:
                lat, lon = parts[0], parts[1]
                calib_lat = calib_meta.latitude if calib_meta and calib_meta.latitude is not None else 19.0760
                calib_lon = calib_meta.longitude if calib_meta and calib_meta.longitude is not None else 72.8777
                if abs(lat - calib_lat) <= 1.5 and abs(lon - calib_lon) <= 1.5:
                    return True
        except Exception:
            pass
        return False

    @classmethod
    def is_lead_time_calibrated(
        cls,
        lead_time_hours: Optional[float | int],
        has_lead_time_profiles: bool = True,
    ) -> bool:
        """
        Validates if empirical historical calibration exists for the given lead time.
        - When multi-lead calibration is active: accepts 24h, 48h, and 72h buckets.
        - Legacy fallback (24h only): accepts 20h - 28h window.
        """
        if lead_time_hours is None:
            return False
        if has_lead_time_profiles:
            return cls.resolve_lead_time_bucket(lead_time_hours) is not None
        try:
            lt = float(lead_time_hours)
            return 20.0 <= lt <= 28.0
        except (ValueError, TypeError):
            return False


    @staticmethod
    def is_variable_calibrated(variable: str) -> bool:
        """
        Validates if empirical historical calibration exists for the meteorological variable.
        Currently calibrated for: 'temperature'.
        """
        return (variable or "").lower().strip() in {"temperature", "temp", "temperature_2m"}

    @staticmethod
    def is_regime_calibrated(weather_regime: str) -> bool:
        """
        Validates if empirical regime-partitioned historical calibration data exists.
        Currently: No empirical regime-partitioned dataset exists yet.
        Returns False to prevent fabricating regime skill adjustments without empirical validation.
        """
        return False

    @classmethod
    def compute_weights(
        cls,
        *,
        region: Optional[str] = None,
        location: Optional[str] = None,
        lead_time_hours: Optional[int | float] = None,
        lead_time: Optional[int | float] = None,
        weather_regime: str = "Normal",
        variable: str = "temperature",
        available_models: Optional[List[str]] = None,
        all_models: Optional[List[str]] = None,
        base_weights: Optional[Dict[str, float]] = None,
        calibration_metadata: Optional[CalibrationMetadata] = None,
        lead_time_result: Optional[LeadTimeCalibrationResult] = None,
        lead_time_profile: Optional[LeadTimeCalibrationProfile] = None,
        calibration_source: Optional[str] = None,
        calibration_window: Optional[str] = None,
        is_calibrated_base: Optional[bool] = None,
    ) -> AdaptiveWeightAudit:
        """
        Computes final normalized weights and generates full audit trail.

        Flow:
        1. Lead-time bucket resolution (+24h, +48h, +72h)
        2. Dimension validation (region, lead_time, variable, regime)
        3. Base weight resolution from verified lead-time profile or baseline
        4. Availability masking (unavailable model = 0.0)
        5. Normalization (sum to exactly 1.0)
        """
        # Resolve aliases
        effective_region = region or location or "Mumbai"
        if lead_time_hours is not None:
            effective_lt = int(round(lead_time_hours))
            requested_lt_float = float(lead_time_hours)
        elif lead_time is not None:
            effective_lt = int(round(lead_time))
            requested_lt_float = float(lead_time)
        else:
            effective_lt = 24
            requested_lt_float = 24.0

        # Resolve model universe
        if all_models:
            models_list = list(all_models)
        elif base_weights:
            models_list = list(base_weights.keys())
        else:
            models_list = list(DEFAULT_MODELS)

        if available_models is None:
            avail_set = set(models_list)
        else:
            avail_set = set(available_models)

        # 1. Resolve lead-time bucket
        bucket = cls.resolve_lead_time_bucket(requested_lt_float)
        matched_profile: Optional[LeadTimeCalibrationProfile] = None

        if lead_time_profile is not None:
            matched_profile = lead_time_profile
        elif lead_time_result is not None and bucket is not None:
            matched_profile = lead_time_result.lead_times.get(bucket)

        resolved_source = calibration_source
        resolved_window = calibration_window
        selected_lead_time: Optional[str] = None
        selected_bucket: Optional[str] = None
        base_profile_weights: Optional[Dict[str, float]] = None

        if matched_profile is not None:
            selected_lead_time = matched_profile.lead_time
            selected_bucket = matched_profile.lead_time
            base_profile_weights = matched_profile.weights
            if not resolved_source:
                resolved_source = "90-day historical skill calibration"
            if not resolved_window and lead_time_result:
                resolved_window = lead_time_result.evaluation_period
        elif calibration_metadata is not None:
            selected_lead_time = calibration_metadata.lead_time
            selected_bucket = calibration_metadata.lead_time
            base_profile_weights = calibration_metadata.weights
            if not resolved_source:
                resolved_source = (
                    "90-day historical skill calibration"
                    if calibration_metadata.total_eval_samples == 2160
                    else "30-day historical skill calibration"
                )
            if not resolved_window:
                resolved_window = calibration_metadata.evaluation_period

        # 2. Evaluate which dimensions have validated empirical calibration
        calibrated_dims: List[str] = []
        fallback_dims: List[str] = []
        fallback_reason: Optional[str] = None

        # Dimension 1: Region
        if cls.is_region_calibrated(effective_region, calibration_metadata):
            calibrated_dims.append("region")
        else:
            fallback_dims.append("region")
            fallback_reason = f"Region '{effective_region}' is outside empirically calibrated geography"

        # Dimension 2: Lead time
        if is_calibrated_base is False:
            fallback_dims.append("lead_time")
            fallback_reason = "Base calibration explicitly disabled or uncalibrated"
        elif matched_profile is not None:
            calibrated_dims.append("lead_time")
        elif bucket is not None and (calibration_metadata is not None or base_weights is not None):
            # In legacy single-lead mode, only the +24h window (20h-28h) is calibrated
            if bucket == "24h" or cls.is_lead_time_calibrated(requested_lt_float, has_lead_time_profiles=False):
                calibrated_dims.append("lead_time")
            else:
                fallback_dims.append("lead_time")
                fallback_reason = f"Lead time {requested_lt_float:.1f}h (+{bucket}) not calibrated in single-horizon baseline"
        else:
            fallback_dims.append("lead_time")
            fallback_reason = f"Lead time {requested_lt_float:.1f}h outside calibrated operational horizons (+24h, +48h, +72h)"

        # Dimension 3: Variable
        if cls.is_variable_calibrated(variable):
            calibrated_dims.append("variable")
        else:
            fallback_dims.append("variable")
            if not fallback_reason:
                fallback_reason = f"Variable '{variable}' has no empirical calibration"

        # Dimension 4: Weather regime
        if cls.is_regime_calibrated(weather_regime):
            calibrated_dims.append("weather_regime")
        else:
            fallback_dims.append("weather_regime")

        # 3. Calibration status is CALIBRATED if region, lead_time, and variable are calibrated
        if is_calibrated_base is False:
            is_core_calibrated = False
        else:
            is_core_calibrated = (
                "region" in calibrated_dims
                and "lead_time" in calibrated_dims
                and "variable" in calibrated_dims
                and (
                    matched_profile is not None
                    or (calibration_metadata is not None and bool(calibration_metadata.is_valid) and bool(calibration_metadata.weights))
                    or (base_weights is not None and (is_calibrated_base is True or cls.is_region_calibrated(effective_region)))
                )
            )
        calibration_status = "CALIBRATED" if is_core_calibrated else "FALLBACK"

        # 4. Determine base weights
        resolved_base_weights: Dict[str, float] = {}
        if is_core_calibrated:
            if base_profile_weights:
                for m in models_list:
                    resolved_base_weights[m] = float(base_profile_weights.get(m, 0.0))
            elif base_weights:
                for m in models_list:
                    resolved_base_weights[m] = float(base_weights.get(m, 0.0))
            else:
                eq_val = 1.0 / len(models_list) if models_list else 0.0
                for m in models_list:
                    resolved_base_weights[m] = eq_val
        elif base_weights:
            for m in models_list:
                resolved_base_weights[m] = float(base_weights.get(m, 0.0))
        else:
            eq_val = 1.0 / len(models_list) if models_list else 0.0
            for m in models_list:
                resolved_base_weights[m] = eq_val

        # Contextual adjustments: zero fabrication
        adjustments: Dict[str, float] = {}

        # Raw weights before availability masking
        raw_weights: Dict[str, float] = {}
        for m in models_list:
            base_w = resolved_base_weights.get(m, 0.0)
            adj = adjustments.get(m, 0.0)
            raw_weights[m] = max(0.0, base_w + adj)

        # 5. Availability masking: unavailable model gets 0.0
        active_weights: Dict[str, float] = {}
        for m in models_list:
            if m in avail_set:
                active_weights[m] = raw_weights[m]
            else:
                active_weights[m] = 0.0

        # 6. Normalization: weights must sum to exactly 1.0 across available models
        avail_sum = sum(active_weights[m] for m in models_list if m in avail_set)
        final_weights: Dict[str, float] = {}

        if avail_sum > 0:
            for m in models_list:
                if m in avail_set:
                    final_weights[m] = active_weights[m] / avail_sum
                else:
                    final_weights[m] = 0.0
        else:
            count_avail = len([m for m in models_list if m in avail_set])
            eq_avail = 1.0 / count_avail if count_avail > 0 else 0.0
            for m in models_list:
                final_weights[m] = eq_avail if m in avail_set else 0.0

        # High precision normalization guarantee
        tot = sum(final_weights.values())
        if tot > 0 and abs(tot - 1.0) > 1e-9:
            final_weights = {m: w / tot for m, w in final_weights.items()}

        model_availability = {m: (m in avail_set) for m in models_list}

        audit = AdaptiveWeightAudit(
            base_weights={m: float(resolved_base_weights.get(m, 0.0)) for m in models_list},
            final_weights={m: float(final_weights.get(m, 0.0)) for m in models_list},
            lead_time=effective_lt,
            region=effective_region,
            weather_regime=weather_regime,
            variable=variable,
            calibration_status=calibration_status,
            calibrated_dimensions=calibrated_dims,
            fallback_dimensions=fallback_dims,
            adjustments=adjustments,
            explanation=ADAPTIVE_EXPLANATION,
            calibration_source=resolved_source,
            calibration_window=resolved_window,
            selected_lead_time=selected_lead_time,
            requested_lead_time=requested_lt_float,
            selected_calibration_bucket=selected_bucket,
            fallback_reason=fallback_reason,
            model_availability=model_availability,
        )

        return audit

