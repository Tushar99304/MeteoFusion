"""
tests/test_adaptive_weights.py — Rigorous tests for Adaptive Weight Engine (SIH26081).

Verifies the 10 requirements:
  A. Existing Mumbai +24h calibration remains unchanged
  B. Weights sum to exactly 1.0
  C. Missing model gets zero weight
  D. Remaining weights renormalize
  E. Unsupported region does not receive fabricated calibration
  F. Unsupported lead time does not receive fabricated calibration
  G. Unsupported regime does not receive fabricated calibration
  H. Adaptive engine integrates with actual production blending
  I. Final blended forecast uses final adaptive weights
  J. Audit metadata correctly reports calibrated vs fallback dimensions
"""

import pytest
from backend.services.adaptive_weights import AdaptiveWeightEngine, AdaptiveWeightAudit
from backend.services.calibration import HistoricalSkillCalibrator
from backend.services.blending import ModelBlendingEngine
from backend.models import ModelForecast, CalibrationMetadata


# Authoritative baseline weights from 30-day ERA5 evaluation in Mumbai (+24h, temp)
MUMBAI_BASE_WEIGHTS = {
    "ECMWF IFS HRES": 0.2828,
    "NCEP GFS": 0.1292,
    "DWD ICON Global": 0.2954,
    "ECMWF AIFS": 0.2926,
}


# ---------------------------------------------------------------------------
# Test A: Existing Mumbai +24h calibration remains unchanged
# ---------------------------------------------------------------------------
def test_a_mumbai_24h_calibration_remains_unchanged():
    """
    The current Mumbai +24h temperature calibration must remain the authoritative
    real calibration profile. No artificial modifications or heuristic shifts.
    """
    import os
    calib_file = os.path.join(os.path.dirname(__file__), "..", "calibration.json")
    cached = HistoricalSkillCalibrator.load_calibration(calib_file)
    assert cached is not None, "Authoritative calibration.json must be present"

    audit = AdaptiveWeightEngine.compute_weights(
        base_weights=cached.weights,
        location="Mumbai",
        lead_time_hours=24,
        weather_regime="Normal",
        variable="temperature",
        is_calibrated_base=True,
    )

    # Weights must match authoritative calibrated base weights (IFS ~28.3%, GFS ~12.9%, ICON ~29.5%, AIFS ~29.3%)
    for model_name, expected_weight in MUMBAI_BASE_WEIGHTS.items():
        assert audit.final_weights[model_name] == pytest.approx(expected_weight, abs=1e-3)
        assert audit.base_weights[model_name] == pytest.approx(expected_weight, abs=1e-3)

    # Zero adjustments applied because regime has no separate empirical calibration
    assert audit.adjustments == {}


# ---------------------------------------------------------------------------
# Test B: Weights sum to exactly 1.0
# ---------------------------------------------------------------------------
def test_b_weights_sum_to_one():
    """Weights must strictly sum to 1.0 across all operational scenarios."""
    scenarios = [
        {"models": None, "base": MUMBAI_BASE_WEIGHTS},
        {"models": ["ECMWF IFS HRES", "ECMWF AIFS"], "base": MUMBAI_BASE_WEIGHTS},
        {"models": ["NCEP GFS"], "base": MUMBAI_BASE_WEIGHTS},
        {"models": ["ECMWF IFS HRES", "NCEP GFS", "DWD ICON Global"], "base": MUMBAI_BASE_WEIGHTS},
        {"models": None, "base": {"M1": 0.5, "M2": 0.3, "M3": 0.2}},
    ]

    for sc in scenarios:
        audit = AdaptiveWeightEngine.compute_weights(
            base_weights=sc["base"],
            location="Mumbai",
            lead_time_hours=24,
            available_models=sc["models"],
        )
        total = sum(audit.final_weights.values())
        assert total == pytest.approx(1.0, abs=1e-5)
        for w in audit.final_weights.values():
            assert w >= 0.0


# ---------------------------------------------------------------------------
# Test C: Missing model gets zero weight
# ---------------------------------------------------------------------------
def test_c_missing_model_gets_zero_weight():
    """An unavailable model must receive exactly 0.0 weight, never a null or non-zero value."""
    audit = AdaptiveWeightEngine.compute_weights(
        base_weights=MUMBAI_BASE_WEIGHTS,
        location="Mumbai",
        lead_time_hours=24,
        available_models=["ECMWF IFS HRES", "ECMWF AIFS"],  # GFS and ICON missing
    )

    assert audit.final_weights["NCEP GFS"] == 0.0
    assert audit.final_weights["DWD ICON Global"] == 0.0
    assert audit.final_weights["ECMWF IFS HRES"] > 0.0
    assert audit.final_weights["ECMWF AIFS"] > 0.0


# ---------------------------------------------------------------------------
# Test D: Remaining weights renormalize
# ---------------------------------------------------------------------------
def test_d_remaining_weights_renormalize():
    """Remaining available models must be renormalized while maintaining relative ratios."""
    available = ["ECMWF IFS HRES", "ECMWF AIFS"]
    audit = AdaptiveWeightEngine.compute_weights(
        base_weights=MUMBAI_BASE_WEIGHTS,
        location="Mumbai",
        lead_time_hours=24,
        available_models=available,
    )

    # Sum must be 1.0
    assert sum(audit.final_weights.values()) == pytest.approx(1.0, abs=1e-5)

    # Relative ratio between IFS and AIFS must be preserved
    ratio_base = MUMBAI_BASE_WEIGHTS["ECMWF IFS HRES"] / MUMBAI_BASE_WEIGHTS["ECMWF AIFS"]
    ratio_final = audit.final_weights["ECMWF IFS HRES"] / audit.final_weights["ECMWF AIFS"]
    assert ratio_final == pytest.approx(ratio_base, abs=1e-3)


# ---------------------------------------------------------------------------
# Test E: Unsupported region does not receive fabricated calibration
# ---------------------------------------------------------------------------
def test_e_unsupported_region_does_not_receive_fabricated_calibration():
    """
    Locations outside Mumbai (e.g. Delhi, London) have no empirical calibration data.
    The system must NOT fabricate calibration for them.
    """
    audit = AdaptiveWeightEngine.compute_weights(
        base_weights={"ECMWF IFS HRES": 0.25, "NCEP GFS": 0.25, "DWD ICON Global": 0.25, "ECMWF AIFS": 0.25},
        location="New Delhi",
        lead_time_hours=24,
        weather_regime="Normal",
        variable="temperature",
        is_calibrated_base=False,
    )

    assert audit.calibration_status == "FALLBACK"
    assert "region" in audit.fallback_dimensions
    assert "region" not in audit.calibrated_dimensions
    assert audit.adjustments == {}


# ---------------------------------------------------------------------------
# Test F: Unsupported lead time does not receive fabricated calibration
# ---------------------------------------------------------------------------
def test_f_unsupported_lead_time_does_not_receive_fabricated_calibration():
    """
    Lead times outside +24h (20h-28h window) have no empirical calibration data.
    E.g. +72h must be recorded as a fallback dimension.
    """
    audit = AdaptiveWeightEngine.compute_weights(
        base_weights=MUMBAI_BASE_WEIGHTS,
        location="Mumbai",
        lead_time_hours=72,  # 72h is not calibrated
        weather_regime="Normal",
        variable="temperature",
        is_calibrated_base=False,
    )

    assert audit.calibration_status == "FALLBACK"
    assert "lead_time" in audit.fallback_dimensions
    assert "lead_time" not in audit.calibrated_dimensions
    assert audit.adjustments == {}


# ---------------------------------------------------------------------------
# Test G: Unsupported regime does not receive fabricated calibration
# ---------------------------------------------------------------------------
def test_g_unsupported_regime_does_not_receive_fabricated_calibration():
    """
    No empirical calibration exists for weather regimes yet.
    The system must not apply arbitrary heuristic % shifts (e.g. +0.2 / -0.1).
    """
    regimes_to_test = ["Extreme Heat", "High Wind", "Heavy Rain", "Monsoon Active"]

    for regime in regimes_to_test:
        audit = AdaptiveWeightEngine.compute_weights(
            base_weights=MUMBAI_BASE_WEIGHTS,
            location="Mumbai",
            lead_time_hours=24,
            weather_regime=regime,
            variable="temperature",
            is_calibrated_base=True,
        )

        # weather_regime must be in fallback dimensions
        assert "weather_regime" in audit.fallback_dimensions
        assert "weather_regime" not in audit.calibrated_dimensions
        # Adjustments must be empty — no fake numbers applied
        assert audit.adjustments == {}
        # Weights remain equal to base weights
        for m, w in MUMBAI_BASE_WEIGHTS.items():
            assert audit.final_weights[m] == pytest.approx(w, abs=1e-3)


# ---------------------------------------------------------------------------
# Test H: Adaptive engine integrates with actual production blending
# ---------------------------------------------------------------------------
def test_h_adaptive_engine_integrates_with_production_blending():
    """
    ModelBlendingEngine.blend_forecasts must execute the full pipeline:
    forecast retrieval -> historical calibration -> adaptive weighting -> normalization -> blended forecast.
    """
    models = [
        ModelForecast(model_name="ECMWF IFS HRES", weight=0.0, temperature_c=30.0, precipitation_mm=2.0, wind_speed_kmh=15.0),
        ModelForecast(model_name="NCEP GFS", weight=0.0, temperature_c=32.0, precipitation_mm=3.0, wind_speed_kmh=18.0),
        ModelForecast(model_name="DWD ICON Global", weight=0.0, temperature_c=31.0, precipitation_mm=2.5, wind_speed_kmh=16.0),
        ModelForecast(model_name="ECMWF AIFS", weight=0.0, temperature_c=30.5, precipitation_mm=2.2, wind_speed_kmh=15.5),
    ]

    engine = ModelBlendingEngine()
    blended = engine.blend_forecasts(
        models=models,
        lat=19.0760,
        lon=72.8777,
        location_name="Mumbai",
        lead_time_hours=24,
        weather_regime="Normal",
    )

    # adaptive_audit must be attached
    assert blended.adaptive_audit is not None
    assert isinstance(blended.adaptive_audit, AdaptiveWeightAudit)
    assert blended.calibration_mode == "CALIBRATED"
    assert blended.adaptive_audit.calibration_status == "CALIBRATED"


# ---------------------------------------------------------------------------
# Test I: Final blended forecast uses final adaptive weights
# ---------------------------------------------------------------------------
def test_i_final_blended_forecast_uses_final_adaptive_weights():
    """
    Verify that blended values (e.g. blended_temperature_c) strictly match
    sum(w_i * T_i) using the final weights from the adaptive engine.
    """
    temps = {
        "ECMWF IFS HRES": 30.0,
        "NCEP GFS": 32.0,
        "DWD ICON Global": 31.0,
        "ECMWF AIFS": 30.5,
    }
    models = [
        ModelForecast(model_name=m, weight=0.0, temperature_c=t)
        for m, t in temps.items()
    ]

    engine = ModelBlendingEngine()
    blended = engine.blend_forecasts(
        models=models,
        lat=19.0760,
        lon=72.8777,
        location_name="Mumbai",
        lead_time_hours=24,
    )

    final_weights = blended.adaptive_audit.final_weights
    expected_temp = sum(final_weights[m.model_name] * temps[m.model_name] for m in models)
    assert blended.blended_temperature_c == pytest.approx(round(expected_temp, 1), abs=1e-4)


# ---------------------------------------------------------------------------
# Test J: Audit metadata correctly reports calibrated vs fallback dimensions
# ---------------------------------------------------------------------------
def test_j_audit_metadata_reports_calibrated_vs_fallback_dimensions():
    """
    Audit structure must accurately state which dimensions are empirically
    calibrated versus which dimensions are on transparent fallback.
    """
    audit = AdaptiveWeightEngine.compute_weights(
        base_weights=MUMBAI_BASE_WEIGHTS,
        location="Mumbai",
        lead_time_hours=24,
        weather_regime="Normal",
        variable="temperature",
        is_calibrated_base=True,
    )

    assert audit.calibration_status == "CALIBRATED"
    assert set(audit.calibrated_dimensions) == {"region", "lead_time", "variable"}
    assert audit.fallback_dimensions == ["weather_regime"]
    assert audit.explanation == (
        "Final weights are derived from historical model skill and contextual calibration where validated data is available."
    )
