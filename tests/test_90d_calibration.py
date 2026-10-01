"""
tests/test_90d_calibration.py — Comprehensive tests for 90-day Historical Skill Calibration (SIH26081 Stage 2).

Tests verify:
  A. 90-day date-window calculation
  B. Fixed +24h lead-time enforcement
  C. Timestamp matching
  D. No data leakage
  E. Missing sample handling
  F. MAE calculation
  G. RMSE calculation
  H. Inverse-MAE weighting
  I. Normalized weights
  J. Existing 30-day calibration remains unchanged
"""

import datetime as dt
import json
import math
import os
import pytest

from backend.models import CalibrationMetadata
from backend.services.calibration import HistoricalSkillCalibrator, MODEL_REGISTRY


# Paths
CALIBRATION_30D_PATH = os.path.join(os.path.dirname(__file__), "..", "calibration.json")
CALIBRATION_90D_PATH = os.path.join(os.path.dirname(__file__), "..", "calibration_90d.json")


# Authoritative 30-day reference values (from calibration.json)
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
# Test A: 90-day date-window calculation
# ---------------------------------------------------------------------------
def test_a_90_day_date_window_calculation():
    """
    The resolve_date_window method with window_days=90 must produce a 90-day
    window ending 5 days before today (ERA5 latency).
    """
    calibrator = HistoricalSkillCalibrator()
    start, end = calibrator.resolve_date_window(window_days=90)

    start_dt = dt.date.fromisoformat(start)
    end_dt = dt.date.fromisoformat(end)
    window = (end_dt - start_dt).days + 1

    assert window == 90, f"Expected 90-day window, got {window}"

    # End date should be approximately 5 days before today
    today = dt.date.today()
    days_from_today = (today - end_dt).days
    # ERA5 latency is typically 5 days; allow 4-6 for timing edge cases
    assert 4 <= days_from_today <= 6, (
        f"End date should be ~5 days before today, got {days_from_today} days"
    )


def test_a_90_day_window_is_distinct_from_30_day():
    """The 90-day window must be strictly larger than the 30-day window."""
    calibrator = HistoricalSkillCalibrator()
    start_30, end_30 = calibrator.resolve_date_window(window_days=30)
    start_90, end_90 = calibrator.resolve_date_window(window_days=90)

    start_30_dt = dt.date.fromisoformat(start_30)
    start_90_dt = dt.date.fromisoformat(start_90)

    # 90-day window must start earlier
    assert start_90_dt < start_30_dt, (
        f"90-day start {start_90} should be earlier than 30-day start {start_30}"
    )
    # Both should have the same end date (same ERA5 latency anchor)
    assert end_30 == end_90


# ---------------------------------------------------------------------------
# Test B: Fixed +24h lead-time enforcement
# ---------------------------------------------------------------------------
def test_b_fixed_lead_time_enforcement():
    """
    All model keys in MODEL_REGISTRY must use 'previous_day1' (fixed +24h offset),
    ensuring strict lead-time control and preventing mixed lead-time contamination.
    """
    for model_name, meta in MODEL_REGISTRY.items():
        key = meta["hourly_key"]
        assert "previous_day1" in key, (
            f"Model {model_name} hourly key '{key}' does not enforce previous_day1 (+24h) offset"
        )


# ---------------------------------------------------------------------------
# Test C: Timestamp matching
# ---------------------------------------------------------------------------
def test_c_timestamp_matching_strict(calibrator):
    """
    Only identical timestamps between forecast and reference should be matched.
    Non-overlapping timestamps must produce zero valid samples.
    """
    fc_times = ["2026-09-01T12:00", "2026-09-01T13:00", "2026-09-01T14:00"]
    ref_times = ["2026-09-01T12:00", "2026-09-01T13:00", "2026-09-01T15:00"]  # 15:00 not in fc

    ref_data = {
        "hourly": {
            "time": ref_times,
            "temperature_2m": [25.0, 26.0, 27.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": fc_times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [26.5, 27.5, 28.5],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8],
        }
    }

    sample_counts, _, _, _, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    # Only 2 timestamps match (12:00 and 13:00), not 14:00 or 15:00
    for model_name in MODEL_REGISTRY:
        assert sample_counts[model_name] == 2, (
            f"{model_name}: expected 2 matched samples, got {sample_counts[model_name]}"
        )


# ---------------------------------------------------------------------------
# Test D: No data leakage
# ---------------------------------------------------------------------------
def test_d_no_leakage_future_timestamps(calibrator):
    """
    Future forecast timestamps that do not exist in the historical reference
    must not be matched. This ensures no data leakage from current/future data.
    """
    future_times = ["2026-10-15T12:00", "2026-10-16T12:00"]
    past_times = ["2026-09-01T12:00", "2026-09-02T12:00"]

    ref_data = {
        "hourly": {
            "time": past_times,
            "temperature_2m": [25.0, 26.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": future_times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [25.0, 26.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [25.0, 26.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.0, 26.0],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.0, 26.0],
        }
    }

    sample_counts, _, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    for model_name in MODEL_REGISTRY:
        assert sample_counts[model_name] == 0, (
            f"{model_name}: expected 0 matched samples (no leakage), got {sample_counts[model_name]}"
        )

    # No model should have weights assigned
    assert len(weights) == 0


# ---------------------------------------------------------------------------
# Test E: Missing sample handling
# ---------------------------------------------------------------------------
def test_e_missing_samples_excluded_not_zeroed(calibrator):
    """
    Null forecast values must be excluded from error calculation,
    not treated as zero. Missing values should reduce sample count
    without corrupting MAE/RMSE.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }

    # ECMWF IFS has 2 nulls, GFS has all valid, ICON has all valid, AIFS has all valid
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, None, 28.0, None, 30.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    sample_counts, maes, _, _, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    # IFS has only 3 valid samples (not 5)
    assert sample_counts["ECMWF IFS HRES"] == 3
    assert sample_counts["NCEP GFS"] == 5
    assert sample_counts["DWD ICON Global"] == 5
    assert sample_counts["ECMWF AIFS"] == 5

    # IFS MAE calculated from only 3 non-null points: |26-25|+|28-27|+|30-29| = 3/3 = 1.0
    assert abs(maes["ECMWF IFS HRES"] - 1.0) < 1e-4


def test_e_model_with_insufficient_data_excluded(calibrator):
    """
    A model with fewer than min_samples valid matched points must be
    excluded from calibration entirely — no fabricated score.
    """
    calibrator_strict = HistoricalSkillCalibrator(epsilon=0.01, min_samples=5)

    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }

    # IFS has only 2 valid samples (below min_samples=5)
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, None, None, None, None],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    sample_counts, maes, _, weights, _ = calibrator_strict.calculate_errors_and_weights(fc_data, ref_data)

    assert sample_counts["ECMWF IFS HRES"] == 1
    assert "ECMWF IFS HRES" not in maes
    assert "ECMWF IFS HRES" not in weights


# ---------------------------------------------------------------------------
# Test F: MAE calculation
# ---------------------------------------------------------------------------
def test_f_mae_calculation_exact(calibrator):
    """
    MAE = mean(|forecast - reference|). Verify with deterministic data.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": times,
            # IFS: errors = 1.0, 1.0, 1.0, 1.0, 1.0 -> MAE = 1.0
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],
            # GFS: errors = 2.0, 2.0, 2.0, 2.0, 2.0 -> MAE = 2.0
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],
            # ICON: errors = 0.5, 0.5, 0.5, 0.5, 0.5 -> MAE = 0.5
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            # AIFS: errors = 0.8, 0.8, 0.8, 0.8, 0.8 -> MAE = 0.8
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    _, maes, _, _, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    assert abs(maes["ECMWF IFS HRES"] - 1.0) < 1e-4
    assert abs(maes["NCEP GFS"] - 2.0) < 1e-4
    assert abs(maes["DWD ICON Global"] - 0.5) < 1e-4
    assert abs(maes["ECMWF AIFS"] - 0.8) < 1e-4


# ---------------------------------------------------------------------------
# Test G: RMSE calculation
# ---------------------------------------------------------------------------
def test_g_rmse_calculation_exact(calibrator):
    """
    RMSE = sqrt(mean(error^2)). Verify with deterministic data.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": times,
            # IFS: constant error 1.0 -> RMSE = 1.0
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],
            # GFS: errors = 0, 0, 0, 0, 5 -> MAE = 1.0, RMSE = sqrt(25/5) = sqrt(5) ≈ 2.236
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [25.0, 26.0, 27.0, 28.0, 34.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    _, _, rmses, _, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    # IFS: constant 1.0 error -> RMSE = 1.0
    assert abs(rmses["ECMWF IFS HRES"] - 1.0) < 1e-4

    # GFS: RMSE = sqrt((0 + 0 + 0 + 0 + 25) / 5) = sqrt(5) ≈ 2.2361
    assert abs(rmses["NCEP GFS"] - math.sqrt(5)) < 1e-4


# ---------------------------------------------------------------------------
# Test H: Inverse-MAE weighting
# ---------------------------------------------------------------------------
def test_h_inverse_mae_weighting(calibrator):
    """
    skill_i = 1 / (MAE_i + epsilon)
    weight_i = skill_i / sum(all skill_i)
    Lower MAE -> higher skill -> higher weight.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],   # MAE=1.0
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],          # MAE=2.0
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],    # MAE=0.5
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],         # MAE=0.8
        }
    }

    _, _, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    eps = 0.01
    # Manually calculate expected weights
    skills = {
        "ECMWF IFS HRES": 1 / (1.0 + eps),
        "NCEP GFS": 1 / (2.0 + eps),
        "DWD ICON Global": 1 / (0.5 + eps),
        "ECMWF AIFS": 1 / (0.8 + eps),
    }
    total_skill = sum(skills.values())
    expected = {m: s / total_skill for m, s in skills.items()}

    for model_name in MODEL_REGISTRY:
        assert abs(weights[model_name] - expected[model_name]) < 1e-3, (
            f"{model_name}: expected weight {expected[model_name]:.4f}, got {weights[model_name]}"
        )

    # Lower MAE must give higher weight
    assert weights["DWD ICON Global"] > weights["ECMWF IFS HRES"]
    assert weights["ECMWF IFS HRES"] > weights["NCEP GFS"]


# ---------------------------------------------------------------------------
# Test I: Normalized weights
# ---------------------------------------------------------------------------
def test_i_normalized_weights_sum_to_one(calibrator):
    """All weights must sum to exactly 1.0."""
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    _, _, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    weight_sum = sum(weights.values())
    assert abs(weight_sum - 1.0) < 1e-4, f"Weight sum {weight_sum} is not 1.0"
    for w in weights.values():
        assert w > 0.0


def test_i_weights_normalized_with_excluded_model():
    """Weights must renormalize to 1.0 even when a model is excluded."""
    calibrator_strict = HistoricalSkillCalibrator(epsilon=0.01, min_samples=5)

    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {
        "hourly": {
            "time": times,
            "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, None, None, None, None],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]: [27.0, 28.0, 29.0, 30.0, 31.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]: [25.8, 26.8, 27.8, 28.8, 29.8],
        }
    }

    _, _, _, weights, _ = calibrator_strict.calculate_errors_and_weights(fc_data, ref_data)

    assert "ECMWF IFS HRES" not in weights
    assert len(weights) == 3
    assert abs(sum(weights.values()) - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# Test J: Existing 30-day calibration remains unchanged
# ---------------------------------------------------------------------------
def test_j_existing_30d_calibration_unchanged():
    """
    The authoritative 30-day calibration.json must be completely unchanged
    after the 90-day calibration process.
    """
    meta_30d = HistoricalSkillCalibrator.load_calibration(CALIBRATION_30D_PATH)
    assert meta_30d is not None, "30-day calibration.json must exist"

    # Evaluation period unchanged
    assert meta_30d.evaluation_period == AUTHORITATIVE_30D["evaluation_period"]

    # Sample counts unchanged
    for model_name, expected in AUTHORITATIVE_30D["sample_counts"].items():
        assert meta_30d.sample_counts[model_name] == expected, (
            f"{model_name} sample count changed: expected {expected}, got {meta_30d.sample_counts[model_name]}"
        )

    # MAE unchanged
    for model_name, expected in AUTHORITATIVE_30D["mae"].items():
        assert abs(meta_30d.mae[model_name] - expected) < 1e-6, (
            f"{model_name} MAE changed: expected {expected}, got {meta_30d.mae[model_name]}"
        )

    # Weights unchanged
    for model_name, expected in AUTHORITATIVE_30D["weights"].items():
        assert abs(meta_30d.weights[model_name] - expected) < 1e-6, (
            f"{model_name} weight changed: expected {expected}, got {meta_30d.weights[model_name]}"
        )

    # Metadata fields unchanged
    assert meta_30d.lead_time == "+24h"
    assert meta_30d.metric == "MAE"
    assert meta_30d.epsilon == 0.01
    assert meta_30d.total_eval_samples == 720
    assert meta_30d.is_valid is True


def test_j_90d_is_separate_file():
    """
    The 90-day calibration must be saved in a separate file from the 30-day one.
    """
    assert os.path.isfile(CALIBRATION_30D_PATH), "30-day calibration.json must exist"
    assert os.path.isfile(CALIBRATION_90D_PATH), "90-day calibration_90d.json must exist"

    with open(CALIBRATION_30D_PATH) as f:
        data_30d = json.load(f)
    with open(CALIBRATION_90D_PATH) as f:
        data_90d = json.load(f)

    # They must have different evaluation periods
    assert data_30d["evaluation_period"] != data_90d["evaluation_period"]
    # 90d should have more samples
    for model_name in MODEL_REGISTRY:
        if model_name in data_90d["sample_counts"]:
            assert data_90d["sample_counts"][model_name] >= data_30d["sample_counts"][model_name]


# ---------------------------------------------------------------------------
# Additional: 90-day calibration structural validation
# ---------------------------------------------------------------------------
def test_90d_calibration_output_valid():
    """The 90-day calibration output must be a valid CalibrationMetadata."""
    meta_90d = HistoricalSkillCalibrator.load_calibration(CALIBRATION_90D_PATH)
    assert meta_90d is not None, "calibration_90d.json must exist and be parseable"
    assert meta_90d.is_valid is True
    assert meta_90d.lead_time == "+24h"
    assert meta_90d.metric == "MAE"
    assert meta_90d.epsilon == 0.01

    # Must have all 4 models
    for model_name in MODEL_REGISTRY:
        assert model_name in meta_90d.sample_counts
        assert model_name in meta_90d.mae
        assert model_name in meta_90d.rmse
        assert model_name in meta_90d.weights
        assert meta_90d.sample_counts[model_name] > 0
        assert meta_90d.mae[model_name] > 0
        assert meta_90d.rmse[model_name] > 0
        assert 0 < meta_90d.weights[model_name] < 1

    # Weights sum to 1.0
    assert abs(sum(meta_90d.weights.values()) - 1.0) < 1e-4

    # 90-day should have 2160 samples per model (24 hrs * 90 days)
    for model_name in MODEL_REGISTRY:
        assert meta_90d.sample_counts[model_name] == 2160


def test_90d_calibration_evaluation_period():
    """The 90-day evaluation period must span 90 days."""
    meta_90d = HistoricalSkillCalibrator.load_calibration(CALIBRATION_90D_PATH)
    assert meta_90d is not None

    parts = meta_90d.evaluation_period.split(" to ")
    assert len(parts) == 2

    start = dt.date.fromisoformat(parts[0].strip())
    end = dt.date.fromisoformat(parts[1].strip())
    span = (end - start).days + 1

    assert span == 90, f"Expected 90-day span, got {span}"
