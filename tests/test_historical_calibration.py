"""
test_historical_calibration.py — Comprehensive tests for Historical Skill Calibration Layer (SIH26081 Phase 1).

Tests satisfy all user requirements:
  A. Four models with valid historical data -> MAE calculated correctly, weights sum to 1.
  B. One model has lower MAE -> receives greater weight than a model with higher MAE.
  C. One model has no valid samples -> excluded, remaining weights renormalized.
  D. Zero MAE -> no division-by-zero, deterministic normalized result.
  E. Historical calibration unavailable -> fallback to demonstration weights.
  F. Future/current forecast data cannot be accidentally used as historical truth (data leakage prevention).
  G. Calibration metadata is preserved end-to-end on BlendedForecastMetadata.
"""

import math
import os
import pytest
from backend.models import ModelForecast, CalibrationMetadata
from backend.services.calibration import HistoricalSkillCalibrator, MODEL_REGISTRY
from backend.services.blending import ModelBlendingEngine


@pytest.fixture
def calibrator():
    return HistoricalSkillCalibrator(epsilon=0.01, min_samples=3)


# ---------------------------------------------------------------------------
# Test A: Four models with valid historical data -> MAE calculated correctly, weights sum to 1
# ---------------------------------------------------------------------------
def test_a_four_models_mae_and_weights_sum_to_one(calibrator):
    """
    Simulate 5 matched timestamps across all 4 models with known errors:
    Ref: [25.0, 26.0, 27.0, 28.0, 29.0]
    ECMWF IFS:  error +1.0 each time -> MAE = 1.0
    NCEP GFS:   error +2.0 each time -> MAE = 2.0
    DWD ICON:   error +0.5 each time -> MAE = 0.5
    ECMWF AIFS: error +0.8 each time -> MAE = 0.8
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
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],  # diff 1.0
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]:        [27.0, 28.0, 29.0, 30.0, 31.0],  # diff 2.0
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],  # diff 0.5
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]:      [25.8, 26.8, 27.8, 28.8, 29.8],  # diff 0.8
        }
    }

    sample_counts, maes, rmses, weights, total_ref = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    assert total_ref == 5
    for name in MODEL_REGISTRY:
        assert sample_counts[name] == 5

    # Check exact MAEs
    assert abs(maes["ECMWF IFS HRES"] - 1.0) < 1e-4
    assert abs(maes["NCEP GFS"] - 2.0) < 1e-4
    assert abs(maes["DWD ICON Global"] - 0.5) < 1e-4
    assert abs(maes["ECMWF AIFS"] - 0.8) < 1e-4

    # Check that weights sum strictly to 1.0
    assert abs(sum(weights.values()) - 1.0) < 1e-4
    for w in weights.values():
        assert w > 0.0


# ---------------------------------------------------------------------------
# Test B: One model has lower MAE -> receives greater weight than model with higher MAE
# ---------------------------------------------------------------------------
def test_b_lower_mae_receives_greater_weight(calibrator):
    """
    DWD ICON has MAE=0.5, NCEP GFS has MAE=2.0.
    DWD ICON skill = 1/(0.5 + 0.01) = 1.9607
    NCEP GFS skill = 1/(2.0 + 0.01) = 0.4975
    DWD ICON weight must be substantially larger than NCEP GFS weight (~4x).
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],  # MAE 1.0
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]:        [27.0, 28.0, 29.0, 30.0, 31.0],  # MAE 2.0
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],  # MAE 0.5
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]:      [26.0, 27.0, 28.0, 29.0, 30.0],  # MAE 1.0
        }
    }

    _, maes, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    assert maes["DWD ICON Global"] < maes["NCEP GFS"]
    assert weights["DWD ICON Global"] > weights["NCEP GFS"]
    assert weights["DWD ICON Global"] > weights["ECMWF IFS HRES"]
    # Ratio should be approximately (1/0.51) / (1/2.01) ≈ 3.94
    assert weights["DWD ICON Global"] > 3.0 * weights["NCEP GFS"]


# ---------------------------------------------------------------------------
# Test C: One model has no valid samples -> excluded, remaining weights renormalized
# ---------------------------------------------------------------------------
def test_c_missing_model_excluded_and_renormalized(calibrator):
    """
    ECMWF AIFS has all None values (0 valid samples).
    min_samples=3 -> AIFS is excluded.
    The remaining 3 models (ECMWF IFS, NCEP GFS, DWD ICON) are calibrated and their weights sum to 1.0.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]:        [27.0, 28.0, 29.0, 30.0, 31.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.5, 26.5, 27.5, 28.5, 29.5],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]:      [None, None, None, None, None],  # 0 samples
        }
    }

    sample_counts, maes, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    assert sample_counts["ECMWF AIFS"] == 0
    assert "ECMWF AIFS" not in maes
    assert "ECMWF AIFS" not in weights

    assert len(weights) == 3
    assert abs(sum(weights.values()) - 1.0) < 1e-4
    for model in ["ECMWF IFS HRES", "NCEP GFS", "DWD ICON Global"]:
        assert weights[model] > 0.0


# ---------------------------------------------------------------------------
# Test D: Zero MAE -> no division-by-zero, deterministic normalized result
# ---------------------------------------------------------------------------
def test_d_zero_mae_no_division_by_zero(calibrator):
    """
    A model has MAE = 0.0 (perfect forecast match with ERA5).
    Division by zero must not occur because of epsilon.
    Weights must be deterministic, non-infinite, and sum to 1.0.
    """
    times = [f"2026-09-0{i}T12:00" for i in range(1, 6)]
    ref_data = {"hourly": {"time": times, "temperature_2m": [25.0, 26.0, 27.0, 28.0, 29.0]}}
    fc_data = {
        "hourly": {
            "time": times,
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [25.0, 26.0, 27.0, 28.0, 29.0],  # MAE = 0.0!
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]:        [26.0, 27.0, 28.0, 29.0, 30.0],  # MAE = 1.0
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [26.0, 27.0, 28.0, 29.0, 30.0],  # MAE = 1.0
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]:      [26.0, 27.0, 28.0, 29.0, 30.0],  # MAE = 1.0
        }
    }

    _, maes, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    assert maes["ECMWF IFS HRES"] == 0.0
    for w in weights.values():
        assert not math.isnan(w)
        assert not math.isinf(w)
        assert w >= 0.0

    assert abs(sum(weights.values()) - 1.0) < 1e-4
    # Zero-MAE model should receive by far the highest weight
    assert weights["ECMWF IFS HRES"] > 0.90


# ---------------------------------------------------------------------------
# Test E: Historical calibration unavailable -> fallback to demonstration weights
# ---------------------------------------------------------------------------
def test_e_calibration_unavailable_fallback():
    """
    When calibration file is missing or region does not match Mumbai,
    ModelBlendingEngine falls back to demonstration weights with:
      - calibration_mode = 'FALLBACK'
      - calibration_metadata = None
      - equal weights (0.25 each for 4 models) in Normal regime
    """
    engine = ModelBlendingEngine(calibration_path="non_existent_calibration_file.json")

    models = [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP", weight=0, temperature_c=25.0),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP", weight=0, temperature_c=26.0),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP", weight=0, temperature_c=24.0),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0, temperature_c=25.5),
    ]

    metadata = engine.blend(models, region="Unknown Region", lead_time_hours=24)

    assert metadata.calibration_mode == "FALLBACK"
    assert metadata.calibration_metadata is None
    for m in metadata.models:
        assert abs(m.weight - 0.25) < 1e-6


# ---------------------------------------------------------------------------
# Test F: Future/current forecast data cannot be accidentally used as historical truth
# ---------------------------------------------------------------------------
def test_f_data_leakage_protection(calibrator):
    """
    Data Leakage Protection:
    1. Timestamps must strictly align with historical reference archive timestamps.
    2. Any forecast timestamp that does not match historical reference time is excluded.
    3. Reference data missing or mismatched raises ValueError / produces 0 valid samples.
    """
    # Mismatched timestamps: forecast has future timestamps, reference has historical
    future_times = ["2026-10-01T12:00", "2026-10-02T12:00", "2026-10-03T12:00"]
    past_times = ["2026-09-01T12:00", "2026-09-02T12:00", "2026-09-03T12:00"]

    ref_data = {
        "hourly": {
            "time": past_times,
            "temperature_2m": [25.0, 26.0, 27.0],
        }
    }
    fc_data = {
        "hourly": {
            "time": future_times,  # Future forecast timestamps
            MODEL_REGISTRY["ECMWF IFS HRES"]["hourly_key"]: [25.0, 26.0, 27.0],
            MODEL_REGISTRY["NCEP GFS"]["hourly_key"]:        [25.0, 26.0, 27.0],
            MODEL_REGISTRY["DWD ICON Global"]["hourly_key"]: [25.0, 26.0, 27.0],
            MODEL_REGISTRY["ECMWF AIFS"]["hourly_key"]:      [25.0, 26.0, 27.0],
        }
    }

    # Strict timestamp matching must find 0 matches between future timestamps and past reference
    sample_counts, maes, _, weights, _ = calibrator.calculate_errors_and_weights(fc_data, ref_data)

    for name in MODEL_REGISTRY:
        assert sample_counts[name] == 0

    assert len(weights) == 0  # No model can be calibrated on mismatched/future timestamps


# ---------------------------------------------------------------------------
# Test G: Calibration metadata is preserved end-to-end
# ---------------------------------------------------------------------------
def test_g_calibration_metadata_preserved(tmp_path):
    """
    When calibrated weights are applied, BlendedForecastMetadata preserves all audit fields:
      - calibrated_at
      - evaluation_period
      - lead_time
      - reference_dataset
      - metric
      - sample_counts
      - mae
      - weights
      - calibration_mode == 'CALIBRATED'
    """
    calib_file = tmp_path / "test_calibration.json"
    meta = CalibrationMetadata(
        calibrated_at="2026-09-30T12:00:00Z",
        evaluation_period="2026-08-26 to 2026-09-24",
        lead_time="+24h",
        location="Mumbai (19.08°N, 72.88°E)",
        latitude=19.0760,
        longitude=72.8777,
        reference_dataset="ERA5 Reanalysis (Open-Meteo Archive API)",
        metric="MAE",
        sample_counts={"ECMWF IFS HRES": 720, "NCEP GFS": 720, "DWD ICON Global": 720, "ECMWF AIFS": 720},
        mae={"ECMWF IFS HRES": 0.68, "NCEP GFS": 1.50, "DWD ICON Global": 0.65, "ECMWF AIFS": 0.66},
        rmse={"ECMWF IFS HRES": 0.84, "NCEP GFS": 1.71, "DWD ICON Global": 0.84, "ECMWF AIFS": 0.84},
        weights={"ECMWF IFS HRES": 0.28, "NCEP GFS": 0.13, "DWD ICON Global": 0.30, "ECMWF AIFS": 0.29},
        epsilon=0.01,
        weighting_scheme="inverse-MAE skill: 1 / (MAE + epsilon)",
        total_eval_samples=720,
        is_valid=True,
    )
    HistoricalSkillCalibrator.save_calibration(meta, str(calib_file))

    engine = ModelBlendingEngine(calibration_path=str(calib_file))
    models = [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP", weight=0, temperature_c=28.0),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP", weight=0, temperature_c=29.0),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP", weight=0, temperature_c=27.5),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0, temperature_c=28.2),
    ]

    # Target is Mumbai at +24h lead time
    metadata = engine.blend(models, region="19.08, 72.88", lead_time_hours=24)

    assert metadata.calibration_mode == "CALIBRATED"
    assert metadata.calibration_metadata is not None
    assert metadata.calibration_metadata.metric == "MAE"
    assert metadata.calibration_metadata.lead_time == "+24h"
    assert metadata.calibration_metadata.evaluation_period == "2026-08-26 to 2026-09-24"
    assert metadata.calibration_metadata.reference_dataset == "ERA5 Reanalysis (Open-Meteo Archive API)"

    # Applied weights should match the calibrated weights
    weights_dict = {m.model_name: m.weight for m in metadata.models}
    assert abs(weights_dict["DWD ICON Global"] - 0.30) < 1e-4
    assert abs(weights_dict["ECMWF AIFS"] - 0.29) < 1e-4
    assert abs(weights_dict["ECMWF IFS HRES"] - 0.28) < 1e-4
    assert abs(weights_dict["NCEP GFS"] - 0.13) < 1e-4
