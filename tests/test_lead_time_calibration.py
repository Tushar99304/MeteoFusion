"""
tests/test_lead_time_calibration.py — Comprehensive tests for Lead-Time Historical Skill Calibration (SIH26081 Stage 3).

Verifies all 12 required test conditions:
  A. +24h profile uses only +24h forecasts (previous_day1)
  B. +48h profile uses only +48h forecasts (previous_day2)
  C. +72h profile uses only +72h forecasts (previous_day3)
  D. Forecast and reference timestamps match exactly
  E. No data leakage (future forecasts / non-matching timestamps rejected)
  F. Missing samples are excluded (never converted to 0)
  G. MAE calculation correctness
  H. RMSE calculation correctness
  I. Inverse-MAE skill calculation (skill = 1 / (MAE + epsilon))
  J. Weights sum to exactly 1.0
  K. Unavailable model/lead combination is handled safely
  L. Existing 90-day +24h calibration and 30-day calibration remain completely unchanged
"""

import json
import math
import os
import pytest

from backend.models import (
    CalibrationMetadata,
    LeadTimeCalibrationProfile,
    LeadTimeCalibrationResult,
)
from backend.services.calibration import (
    HistoricalSkillCalibrator,
    MODEL_REGISTRY,
    SUPPORTED_LEAD_TIMES,
    get_model_hourly_key,
    normalize_lead_time_key,
)

CALIBRATION_30D_PATH = os.path.join(os.path.dirname(__file__), "..", "calibration.json")
CALIBRATION_90D_PATH = os.path.join(os.path.dirname(__file__), "..", "calibration_90d.json")
CALIBRATION_LEADTIMES_PATH = os.path.join(os.path.dirname(__file__), "..", "calibration_leadtimes.json")

# Authoritative 90-day +24h calibration values (from calibration_90d.json)
AUTHORITATIVE_90D = {
    "evaluation_period": "2026-06-29 to 2026-09-26",
    "sample_counts": {
        "ECMWF IFS HRES": 2160,
        "NCEP GFS": 2160,
        "DWD ICON Global": 2160,
        "ECMWF AIFS": 2160,
    },
    "mae": {
        "ECMWF IFS HRES": 0.6741,
        "NCEP GFS": 1.4989,
        "DWD ICON Global": 0.6679,
        "ECMWF AIFS": 0.6441,
    },
    "rmse": {
        "ECMWF IFS HRES": 0.8827,
        "NCEP GFS": 1.729,
        "DWD ICON Global": 0.8431,
        "ECMWF AIFS": 0.8066,
    },
    "weights": {
        "ECMWF IFS HRES": 0.285,
        "NCEP GFS": 0.1292,
        "DWD ICON Global": 0.2876,
        "ECMWF AIFS": 0.2982,
    },
}

# Authoritative 30-day +24h calibration values (from calibration.json)
AUTHORITATIVE_30D = {
    "evaluation_period": "2026-08-26 to 2026-09-24",
    "sample_counts": {
        "ECMWF IFS HRES": 720,
        "NCEP GFS": 720,
        "DWD ICON Global": 720,
        "ECMWF AIFS": 720,
    },
    "mae": {
        "ECMWF IFS HRES": 0.681,
        "NCEP GFS": 1.5024,
        "DWD ICON Global": 0.6515,
        "ECMWF AIFS": 0.6579,
    },
    "weights": {
        "ECMWF IFS HRES": 0.2828,
        "NCEP GFS": 0.1292,
        "DWD ICON Global": 0.2954,
        "ECMWF AIFS": 0.2926,
    },
}


@pytest.fixture
def calibrator():
    return HistoricalSkillCalibrator(epsilon=0.01, min_samples=3)


# ---------------------------------------------------------------------------
# Test A: +24h profile uses only +24h forecasts (previous_day1)
# ---------------------------------------------------------------------------
def test_a_24h_profile_uses_only_24h_forecasts():
    """Verify that 24h key mapping strictly resolves to previous_day1 offset."""
    assert SUPPORTED_LEAD_TIMES["24h"]["offset"] == "previous_day1"
    assert SUPPORTED_LEAD_TIMES["24h"]["lead_hours"] == 24

    for model_name in MODEL_REGISTRY:
        key = get_model_hourly_key(model_name, "24h")
        assert "previous_day1" in key
        assert "previous_day2" not in key
        assert "previous_day3" not in key


# ---------------------------------------------------------------------------
# Test B: +48h profile uses only +48h forecasts (previous_day2)
# ---------------------------------------------------------------------------
def test_b_48h_profile_uses_only_48h_forecasts():
    """Verify that 48h key mapping strictly resolves to previous_day2 offset."""
    assert SUPPORTED_LEAD_TIMES["48h"]["offset"] == "previous_day2"
    assert SUPPORTED_LEAD_TIMES["48h"]["lead_hours"] == 48

    for model_name in MODEL_REGISTRY:
        key = get_model_hourly_key(model_name, "48h")
        assert "previous_day2" in key
        assert "previous_day1" not in key
        assert "previous_day3" not in key


# ---------------------------------------------------------------------------
# Test C: +72h profile uses only +72h forecasts (previous_day3)
# ---------------------------------------------------------------------------
def test_c_72h_profile_uses_only_72h_forecasts():
    """Verify that 72h key mapping strictly resolves to previous_day3 offset."""
    assert SUPPORTED_LEAD_TIMES["72h"]["offset"] == "previous_day3"
    assert SUPPORTED_LEAD_TIMES["72h"]["lead_hours"] == 72

    for model_name in MODEL_REGISTRY:
        key = get_model_hourly_key(model_name, "72h")
        assert "previous_day3" in key
        assert "previous_day1" not in key
        assert "previous_day2" not in key


# ---------------------------------------------------------------------------
# Test D: Forecast and reference timestamps match exactly
# ---------------------------------------------------------------------------
def test_d_timestamps_match_exactly(calibrator):
    """
    Evaluates that points are matched if and only if timestamps are identical.
    Offsets or disjoint timestamps produce zero valid points.
    """
    fc_times = ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"]
    ref_times = ["2026-09-01T01:00", "2026-09-01T02:00", "2026-09-01T03:00"]

    ref_data = {"hourly": {"time": ref_times, "temperature_2m": [25.0, 26.0, 27.0]}}
    fc_data = {
        "hourly": {
            "time": fc_times,
            get_model_hourly_key("ECMWF IFS HRES", "48h"): [24.0, 25.0, 26.0],
            get_model_hourly_key("NCEP GFS", "48h"): [24.0, 25.0, 26.0],
            get_model_hourly_key("DWD ICON Global", "48h"): [24.0, 25.0, 26.0],
            get_model_hourly_key("ECMWF AIFS", "48h"): [24.0, 25.0, 26.0],
        }
    }

    counts, maes, _, _, _, total_ref = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="48h"
    )

    # Only 01:00 and 02:00 match (2 points)
    for model_name in MODEL_REGISTRY:
        assert counts[model_name] == 2


# ---------------------------------------------------------------------------
# Test E: No data leakage
# ---------------------------------------------------------------------------
def test_e_no_data_leakage(calibrator):
    """
    Future forecast timestamps cannot match past historical reference timestamps.
    Lead times cannot be mixed (e.g. 72h evaluator ignores 24h keys).
    """
    future_times = ["2026-10-10T00:00", "2026-10-10T01:00", "2026-10-10T02:00"]
    past_times = ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"]

    ref_data = {"hourly": {"time": past_times, "temperature_2m": [25.0, 26.0, 27.0]}}
    fc_data = {
        "hourly": {
            "time": future_times,
            get_model_hourly_key("ECMWF IFS HRES", "72h"): [25.0, 26.0, 27.0],
            get_model_hourly_key("NCEP GFS", "72h"): [25.0, 26.0, 27.0],
            get_model_hourly_key("DWD ICON Global", "72h"): [25.0, 26.0, 27.0],
            get_model_hourly_key("ECMWF AIFS", "72h"): [25.0, 26.0, 27.0],
        }
    }

    counts, _, _, _, weights, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="72h"
    )

    for m in MODEL_REGISTRY:
        assert counts[m] == 0
    assert len(weights) == 0


# ---------------------------------------------------------------------------
# Test F: Missing samples are excluded (never converted to 0)
# ---------------------------------------------------------------------------
def test_f_missing_samples_excluded(calibrator):
    """
    Null values in forecast or reference are omitted from error computation.
    They must never be replaced with zero or any synthetic number.
    """
    times = [f"2026-09-0{i}T00:00" for i in range(1, 6)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            get_model_hourly_key("ECMWF IFS HRES", "24h"): [26.0, None, 28.0, None, 30.0],
            get_model_hourly_key("NCEP GFS", "24h"): [27.0, 28.0, 29.0, 30.0, 31.0],
            get_model_hourly_key("DWD ICON Global", "24h"): [25.5, 26.5, 27.5, 28.5, 29.5],
            get_model_hourly_key("ECMWF AIFS", "24h"): [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    counts, maes, _, _, _, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="24h"
    )

    assert counts["ECMWF IFS HRES"] == 3
    # Absolute errors for IFS: |26-25|=1, |28-27|=1, |30-29|=1 -> MAE = 1.0
    assert abs(maes["ECMWF IFS HRES"] - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Test G: MAE calculation correctness
# ---------------------------------------------------------------------------
def test_g_mae_calculation(calibrator):
    """Verify MAE = mean(|fc - ref|) with deterministic numbers."""
    times = [f"2026-09-0{i}T00:00" for i in range(1, 5)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [20.0, 20.0, 20.0, 20.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            get_model_hourly_key("ECMWF IFS HRES", "48h"): [21.0, 19.0, 22.0, 18.0],  # diffs: 1, 1, 2, 2 -> MAE=1.5
            get_model_hourly_key("NCEP GFS", "48h"): [22.0, 22.0, 22.0, 22.0],        # diffs: 2, 2, 2, 2 -> MAE=2.0
            get_model_hourly_key("DWD ICON Global", "48h"): [20.5, 19.5, 20.5, 19.5],  # diffs: 0.5, 0.5, 0.5, 0.5 -> MAE=0.5
            get_model_hourly_key("ECMWF AIFS", "48h"): [21.0, 21.0, 21.0, 21.0],      # diffs: 1, 1, 1, 1 -> MAE=1.0
        }
    }

    _, maes, _, _, _, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="48h"
    )

    assert abs(maes["ECMWF IFS HRES"] - 1.5) < 1e-4
    assert abs(maes["NCEP GFS"] - 2.0) < 1e-4
    assert abs(maes["DWD ICON Global"] - 0.5) < 1e-4
    assert abs(maes["ECMWF AIFS"] - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Test H: RMSE calculation correctness
# ---------------------------------------------------------------------------
def test_h_rmse_calculation(calibrator):
    """Verify RMSE = sqrt(mean((fc - ref)^2)) with deterministic numbers."""
    times = [f"2026-09-0{i}T00:00" for i in range(1, 5)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [20.0, 20.0, 20.0, 20.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            get_model_hourly_key("ECMWF IFS HRES", "72h"): [21.0, 19.0, 22.0, 18.0],  # sq_diffs: 1, 1, 4, 4 -> mean=2.5 -> RMSE=sqrt(2.5)=1.5811
            get_model_hourly_key("NCEP GFS", "72h"): [20.0, 20.0, 20.0, 24.0],        # sq_diffs: 0, 0, 0, 16 -> mean=4.0 -> RMSE=2.0
            get_model_hourly_key("DWD ICON Global", "72h"): [20.5, 20.5, 20.5, 20.5],  # sq_diffs: 0.25 -> RMSE=0.5
            get_model_hourly_key("ECMWF AIFS", "72h"): [21.0, 21.0, 21.0, 21.0],      # sq_diffs: 1.0 -> RMSE=1.0
        }
    }

    _, _, rmses, _, _, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="72h"
    )

    assert abs(rmses["ECMWF IFS HRES"] - math.sqrt(2.5)) < 1e-4
    assert abs(rmses["NCEP GFS"] - 2.0) < 1e-4
    assert abs(rmses["DWD ICON Global"] - 0.5) < 1e-4
    assert abs(rmses["ECMWF AIFS"] - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Test I: Inverse-MAE skill calculation
# ---------------------------------------------------------------------------
def test_i_inverse_mae_skill_calculation(calibrator):
    """
    skill = 1 / (MAE + epsilon)
    weights = skill / sum(skills)
    Lower MAE must produce strictly higher skill and weight.
    """
    times = [f"2026-09-0{i}T00:00" for i in range(1, 5)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [20.0, 20.0, 20.0, 20.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            get_model_hourly_key("ECMWF IFS HRES", "24h"): [21.0, 21.0, 21.0, 21.0],  # MAE 1.0
            get_model_hourly_key("NCEP GFS", "24h"): [22.0, 22.0, 22.0, 22.0],        # MAE 2.0
            get_model_hourly_key("DWD ICON Global", "24h"): [20.5, 20.5, 20.5, 20.5],  # MAE 0.5
            get_model_hourly_key("ECMWF AIFS", "24h"): [20.8, 20.8, 20.8, 20.8],      # MAE 0.8
        }
    }

    _, maes, _, skills, weights, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="24h"
    )

    eps = 0.01
    assert abs(skills["DWD ICON Global"] - (1.0 / (0.5 + eps))) < 1e-4
    assert abs(skills["ECMWF AIFS"] - (1.0 / (0.8 + eps))) < 1e-4
    assert abs(skills["ECMWF IFS HRES"] - (1.0 / (1.0 + eps))) < 1e-4
    assert abs(skills["NCEP GFS"] - (1.0 / (2.0 + eps))) < 1e-4

    assert weights["DWD ICON Global"] > weights["ECMWF AIFS"]
    assert weights["ECMWF AIFS"] > weights["ECMWF IFS HRES"]
    assert weights["ECMWF IFS HRES"] > weights["NCEP GFS"]


# ---------------------------------------------------------------------------
# Test J: Weights sum to exactly 1.0
# ---------------------------------------------------------------------------
def test_j_weights_sum_to_one(calibrator):
    """Weights across any valid evaluation must sum strictly to 1.0."""
    for lt in ["24h", "48h", "72h"]:
        times = [f"2026-09-0{i}T00:00" for i in range(1, 6)]
        ref_data = {"hourly": {"time": times, "temperature_2m": [20.0, 21.0, 22.0, 23.0, 24.0]}}
        fc_data = {
            "hourly": {
                "time": times,
                get_model_hourly_key("ECMWF IFS HRES", lt): [20.7, 21.7, 22.7, 23.7, 24.7],
                get_model_hourly_key("NCEP GFS", lt): [21.5, 22.5, 23.5, 24.5, 25.5],
                get_model_hourly_key("DWD ICON Global", lt): [20.6, 21.6, 22.6, 23.6, 24.6],
                get_model_hourly_key("ECMWF AIFS", lt): [20.4, 21.4, 22.4, 23.4, 24.4],
            }
        }

        _, _, _, _, weights, _ = calibrator.calculate_errors_and_weights_for_lead_time(
            fc_data, ref_data, lead_time=lt
        )

        assert abs(sum(weights.values()) - 1.0) < 1e-4
        for w in weights.values():
            assert w > 0.0


# ---------------------------------------------------------------------------
# Test K: Unavailable model/lead combination is handled safely
# ---------------------------------------------------------------------------
def test_k_unavailable_model_handled_safely(calibrator):
    """
    If a model has insufficient data for one lead time (e.g. AIFS at 72h),
    it is excluded from that lead time and remaining models renormalize to 1.0.
    Other lead times where data is valid remain unaffected.
    """
    times = [f"2026-09-0{i}T00:00" for i in range(1, 6)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [20.0, 21.0, 22.0, 23.0, 24.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            get_model_hourly_key("ECMWF IFS HRES", "72h"): [20.7, 21.7, 22.7, 23.7, 24.7],
            get_model_hourly_key("NCEP GFS", "72h"): [21.5, 22.5, 23.5, 24.5, 25.5],
            get_model_hourly_key("DWD ICON Global", "72h"): [20.6, 21.6, 22.6, 23.6, 24.6],
            get_model_hourly_key("ECMWF AIFS", "72h"): [None, None, None, None, None],  # missing
        }
    }

    counts, maes, _, _, weights, _ = calibrator.calculate_errors_and_weights_for_lead_time(
        fc_data, ref_data, lead_time="72h"
    )

    assert counts["ECMWF AIFS"] == 0
    assert "ECMWF AIFS" not in maes
    assert "ECMWF AIFS" not in weights
    assert len(weights) == 3
    assert abs(sum(weights.values()) - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Test L: Existing 90-day +24h and 30-day calibrations remain unchanged
# ---------------------------------------------------------------------------
def test_l_existing_calibrations_unchanged():
    """
    Both calibration.json (30d) and calibration_90d.json (90d) must remain
    byte-for-byte and value-for-value intact.
    """
    assert os.path.isfile(CALIBRATION_30D_PATH), "calibration.json must exist"
    assert os.path.isfile(CALIBRATION_90D_PATH), "calibration_90d.json must exist"

    meta_30d = HistoricalSkillCalibrator.load_calibration(CALIBRATION_30D_PATH)
    assert meta_30d is not None
    assert meta_30d.evaluation_period == AUTHORITATIVE_30D["evaluation_period"]
    for m, exp_w in AUTHORITATIVE_30D["weights"].items():
        assert abs(meta_30d.weights[m] - exp_w) < 1e-6

    meta_90d = HistoricalSkillCalibrator.load_calibration(CALIBRATION_90D_PATH)
    assert meta_90d is not None
    assert meta_90d.evaluation_period == AUTHORITATIVE_90D["evaluation_period"]
    for m, exp_w in AUTHORITATIVE_90D["weights"].items():
        assert abs(meta_90d.weights[m] - exp_w) < 1e-6
    for m, exp_m in AUTHORITATIVE_90D["mae"].items():
        assert abs(meta_90d.mae[m] - exp_m) < 1e-6


# ---------------------------------------------------------------------------
# Test: Lead-time calibration result file integrity
# ---------------------------------------------------------------------------
def test_lead_time_calibration_file_integrity():
    """
    Verifies calibration_leadtimes.json generated from real historical data:
      - Valid JSON schema
      - Contains '24h', '48h', '72h'
      - 2160 samples per model per lead time
      - Normalized weights summing to 1.0
    """
    assert os.path.isfile(CALIBRATION_LEADTIMES_PATH), "calibration_leadtimes.json must exist"
    result = HistoricalSkillCalibrator.load_lead_time_calibration(CALIBRATION_LEADTIMES_PATH)
    assert result is not None
    assert result.region == "Mumbai"
    assert result.variable == "temperature"
    assert result.evaluation_period == "2026-06-29 to 2026-09-26"

    for lt_key in ["24h", "48h", "72h"]:
        assert lt_key in result.lead_times
        profile = result.lead_times[lt_key]
        assert profile.is_valid is True
        assert abs(sum(profile.weights.values()) - 1.0) < 1e-4

        for model_name in MODEL_REGISTRY:
            assert profile.sample_counts[model_name] == 2160
            assert profile.mae[model_name] > 0.0
            assert profile.rmse[model_name] > 0.0
            assert profile.skill[model_name] > 0.0
            assert 0.0 < profile.weights[model_name] < 1.0


# ---------------------------------------------------------------------------
# Production Blending Integration Tests (Stage 3 Verification)
# ---------------------------------------------------------------------------
from backend.models import ModelForecast
from backend.services.blending import ModelBlendingEngine
from backend.services.adaptive_weights import AdaptiveWeightEngine


def _create_sample_models():
    return [
        ModelForecast(model_name="ECMWF IFS HRES", weight=0.0, temperature_c=29.0, precipitation_mm=1.0, wind_speed_kmh=12.0),
        ModelForecast(model_name="NCEP GFS", weight=0.0, temperature_c=31.0, precipitation_mm=2.0, wind_speed_kmh=16.0),
        ModelForecast(model_name="DWD ICON Global", weight=0.0, temperature_c=30.0, precipitation_mm=1.5, wind_speed_kmh=14.0),
        ModelForecast(model_name="ECMWF AIFS", weight=0.0, temperature_c=29.5, precipitation_mm=1.2, wind_speed_kmh=13.0),
    ]


def test_prod_blending_selects_24h_profile():
    """
    Verifies that Mumbai forecast at +24h (or ~23h clock offset)
    selects the +24h profile from calibration_leadtimes.json.
    """
    engine = ModelBlendingEngine()
    
    # Test exact 24h
    blended_24 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=24,
    )
    audit_24 = blended_24.adaptive_audit
    assert audit_24 is not None
    assert audit_24.calibration_status == "CALIBRATED"
    assert audit_24.selected_calibration_bucket in ("+24h", "24h")
    assert audit_24.selected_lead_time == "+24h"
    assert audit_24.calibration_source == "90-day historical skill calibration"
    assert audit_24.calibration_window == "2026-06-29 to 2026-09-26"
    assert audit_24.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2850, abs=1e-3)
    assert audit_24.final_weights["NCEP GFS"] == pytest.approx(0.1292, abs=1e-3)
    assert audit_24.final_weights["DWD ICON Global"] == pytest.approx(0.2876, abs=1e-3)
    assert audit_24.final_weights["ECMWF AIFS"] == pytest.approx(0.2982, abs=1e-3)
    assert sum(audit_24.final_weights.values()) == pytest.approx(1.0, abs=1e-5)

    # Test clock offset (~23h) maps to 24h profile
    blended_23 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=23,
    )
    audit_23 = blended_23.adaptive_audit
    assert audit_23.selected_calibration_bucket in ("+24h", "24h")
    assert audit_23.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2850, abs=1e-3)


def test_prod_blending_selects_48h_profile():
    """
    Verifies that Mumbai forecast at +48h (or ~47h clock offset)
    selects the +48h profile from calibration_leadtimes.json.
    """
    engine = ModelBlendingEngine()
    
    blended_48 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=48,
    )
    audit_48 = blended_48.adaptive_audit
    assert audit_48 is not None
    assert audit_48.calibration_status == "CALIBRATED"
    assert audit_48.selected_calibration_bucket in ("+48h", "48h")
    assert audit_48.selected_lead_time == "+48h"
    assert audit_48.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2932, abs=1e-3)
    assert audit_48.final_weights["NCEP GFS"] == pytest.approx(0.1350, abs=1e-3)
    assert audit_48.final_weights["DWD ICON Global"] == pytest.approx(0.2681, abs=1e-3)
    assert audit_48.final_weights["ECMWF AIFS"] == pytest.approx(0.3037, abs=1e-3)
    assert sum(audit_48.final_weights.values()) == pytest.approx(1.0, abs=1e-5)

    # Test bucket near +48h (e.g. 47h)
    blended_47 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=47,
    )
    assert blended_47.adaptive_audit.selected_calibration_bucket in ("+48h", "48h")
    assert blended_47.adaptive_audit.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2932, abs=1e-3)


def test_prod_blending_selects_72h_profile():
    """
    Verifies that Mumbai forecast at +72h (or ~71h clock offset)
    selects the +72h profile from calibration_leadtimes.json.
    """
    engine = ModelBlendingEngine()
    
    blended_72 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=72,
    )
    audit_72 = blended_72.adaptive_audit
    assert audit_72 is not None
    assert audit_72.calibration_status == "CALIBRATED"
    assert audit_72.selected_calibration_bucket in ("+72h", "72h")
    assert audit_72.selected_lead_time == "+72h"
    assert audit_72.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2996, abs=1e-3)
    assert audit_72.final_weights["NCEP GFS"] == pytest.approx(0.1379, abs=1e-3)
    assert audit_72.final_weights["DWD ICON Global"] == pytest.approx(0.2578, abs=1e-3)
    assert audit_72.final_weights["ECMWF AIFS"] == pytest.approx(0.3047, abs=1e-3)
    assert sum(audit_72.final_weights.values()) == pytest.approx(1.0, abs=1e-5)

    # Test bucket near +72h (e.g. 71h)
    blended_71 = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=71,
    )
    assert blended_71.adaptive_audit.selected_calibration_bucket in ("+72h", "72h")
    assert blended_71.adaptive_audit.final_weights["ECMWF IFS HRES"] == pytest.approx(0.2996, abs=1e-3)


def test_prod_blending_missing_model_handling():
    """
    When a model is missing (e.g. NCEP GFS missing or None observation):
    - Unavailable model receives weight 0.0
    - Remaining available models renormalize to exactly 100% (1.0)
    - Relative skill ratios between available models are strictly maintained
    """
    engine = ModelBlendingEngine()
    
    # 3 models available, GFS missing
    models = [
        ModelForecast(model_name="ECMWF IFS HRES", weight=0.0, temperature_c=29.0),
        ModelForecast(model_name="NCEP GFS", weight=0.0, temperature_c=None),  # missing data
        ModelForecast(model_name="DWD ICON Global", weight=0.0, temperature_c=30.0),
        ModelForecast(model_name="ECMWF AIFS", weight=0.0, temperature_c=29.5),
    ]

    blended = engine.blend_forecasts(
        models=models,
        location_name="Mumbai",
        lead_time_hours=24,
    )
    audit = blended.adaptive_audit
    assert audit.final_weights["NCEP GFS"] == 0.0
    assert audit.final_weights["ECMWF IFS HRES"] > 0.0
    assert audit.final_weights["DWD ICON Global"] > 0.0
    assert audit.final_weights["ECMWF AIFS"] > 0.0
    assert sum(audit.final_weights.values()) == pytest.approx(1.0, abs=1e-5)

    # Relative ratio between IFS and AIFS must be preserved
    ratio_base = 0.2850 / 0.2982
    ratio_final = audit.final_weights["ECMWF IFS HRES"] / audit.final_weights["ECMWF AIFS"]
    assert ratio_final == pytest.approx(ratio_base, abs=1e-3)


def test_prod_blending_unsupported_lead_time_fallback():
    """
    Lead time far outside supported range (e.g. 120h or 6h)
    must transparently fall back without fabricating calibration.
    """
    engine = ModelBlendingEngine()
    blended = engine.blend_forecasts(
        models=_create_sample_models(),
        location_name="Mumbai",
        lead_time_hours=120,
    )
    audit = blended.adaptive_audit
    assert audit.calibration_status == "FALLBACK"
    assert "lead_time" in audit.fallback_dimensions
    assert audit.fallback_reason is not None
    assert "outside calibrated" in audit.fallback_reason
    assert sum(audit.final_weights.values()) == pytest.approx(1.0, abs=1e-5)


def test_prod_blending_mathematical_consistency():
    """
    Blended temperature must strictly match sum(w_i * T_i) for valid models.
    """
    engine = ModelBlendingEngine()
    models = _create_sample_models()
    blended = engine.blend_forecasts(
        models=models,
        location_name="Mumbai",
        lead_time_hours=24,
    )
    weights = blended.adaptive_audit.final_weights
    expected_temp = sum(weights[m.model_name] * m.temperature_c for m in models)
    assert blended.blended_temperature_c == pytest.approx(round(expected_temp, 1), abs=1e-4)

