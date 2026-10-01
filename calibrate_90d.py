"""
calibrate_90d.py — Stage 2: 90-day Historical Skill Calibration for Mumbai +24h Temperature.

This script:
1. Probes the Open-Meteo Previous Runs API to check data availability for a 90-day window.
2. Reports per-model sample counts BEFORE computing any metrics.
3. If all four models have sufficient data, runs full calibration.
4. Saves results to calibration_90d.json (separate from the existing 30-day calibration.json).
5. Produces a comparison report: 30-day vs 90-day.

It does NOT modify calibration.json or switch production blending.
"""

import datetime as dt
import json
import math
import os
import sys

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.services.calibration import HistoricalSkillCalibrator, MODEL_REGISTRY
from backend.models import CalibrationMetadata

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────
LATITUDE  = 19.0760
LONGITUDE = 72.8777
LOCATION  = "Mumbai"
WINDOW_DAYS = 90
ERA5_LATENCY_DAYS = 5
MIN_SAMPLES_PER_MODEL = 24   # same threshold as existing calibration

# Output
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration_90d.json")
EXISTING_30D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json")


def main():
    today = dt.date.today()
    end_date = today - dt.timedelta(days=ERA5_LATENCY_DAYS)
    start_date = end_date - dt.timedelta(days=WINDOW_DAYS - 1)

    print("=" * 80)
    print("MeteoFusion SIH26081 — Stage 2: 90-Day Historical Skill Calibration")
    print("=" * 80)
    print(f"Location      : {LOCATION} ({LATITUDE}°N, {LONGITUDE}°E)")
    print(f"Variable      : temperature_2m")
    print(f"Lead time     : +24h (previous_day1)")
    print(f"Today          : {today}")
    print(f"Evaluation     : {start_date} to {end_date} ({WINDOW_DAYS} days)")
    print(f"ERA5 latency   : {ERA5_LATENCY_DAYS} days")
    print(f"Min samples    : {MIN_SAMPLES_PER_MODEL}")
    print()

    calibrator = HistoricalSkillCalibrator()

    # ── Step 1: Fetch forecast data ──────────────────────────────────────────
    print("Step 1: Fetching +24h forecast data from Open-Meteo Previous Runs API...")
    try:
        fc_data = calibrator.fetch_forecast_data(
            LATITUDE, LONGITUDE, start_date.isoformat(), end_date.isoformat()
        )
    except Exception as e:
        print(f"  ✗ FAILED to fetch forecast data: {e}")
        print("  STOPPING: Cannot proceed without forecast data.")
        return

    fc_hourly = fc_data.get("hourly", {})
    fc_times = fc_hourly.get("time", [])
    print(f"  ✓ Received {len(fc_times)} hourly timestamps from forecast API")

    # ── Step 2: Check per-model data availability ────────────────────────────
    print("\nStep 2: Checking per-model data availability...")
    availability = {}
    all_available = True

    for model_name, meta in MODEL_REGISTRY.items():
        key = meta["hourly_key"]
        values = fc_hourly.get(key, [])
        non_null = sum(1 for v in values if v is not None)
        total = len(values)
        availability[model_name] = {
            "total_slots": total,
            "non_null": non_null,
            "null": total - non_null,
            "coverage_pct": round(100 * non_null / total, 1) if total > 0 else 0,
            "sufficient": non_null >= MIN_SAMPLES_PER_MODEL,
        }
        status = "✓" if non_null >= MIN_SAMPLES_PER_MODEL else "✗ INSUFFICIENT"
        print(f"  {model_name:25s}: {non_null:5d} / {total:5d} non-null ({availability[model_name]['coverage_pct']}%) {status}")
        if non_null < MIN_SAMPLES_PER_MODEL:
            all_available = False

    if not all_available:
        print("\n⚠ NOT ALL MODELS have sufficient 90-day forecast data.")
        print("  Reporting limitations below. Calibration will proceed only for models with data.")
        print("  Models without data will be marked unavailable (not fabricated).")

    # ── Step 3: Fetch ERA5 reference data ────────────────────────────────────
    print("\nStep 3: Fetching ERA5 reanalysis reference data...")
    try:
        ref_data = calibrator.fetch_reference_data(
            LATITUDE, LONGITUDE, start_date.isoformat(), end_date.isoformat()
        )
    except Exception as e:
        print(f"  ✗ FAILED to fetch reference data: {e}")
        print("  STOPPING: Cannot proceed without reference truth.")
        return

    ref_hourly = ref_data.get("hourly", {})
    ref_times = ref_hourly.get("time", [])
    ref_temps = ref_hourly.get("temperature_2m", [])
    ref_non_null = sum(1 for t in ref_temps if t is not None)
    print(f"  ✓ Received {len(ref_times)} hourly timestamps, {ref_non_null} non-null temperatures")

    # ── Step 4: Run error calculation ────────────────────────────────────────
    print("\nStep 4: Computing MAE / RMSE / Weights...")
    try:
        sample_counts, maes, rmses, weights, total_ref = calibrator.calculate_errors_and_weights(
            fc_data, ref_data
        )
    except Exception as e:
        print(f"  ✗ Error calculation failed: {e}")
        return

    print(f"  Total reference points: {total_ref}")
    print()

    # ── Step 5: Report results ───────────────────────────────────────────────
    print("=" * 80)
    print("90-DAY CALIBRATION RESULTS")
    print("=" * 80)
    print(f"  Evaluation period : {start_date} to {end_date}")
    print(f"  Reference dataset : ERA5 Reanalysis (Open-Meteo Archive API)")
    print(f"  Weighting scheme  : inverse-MAE skill: 1 / (MAE + ε), ε = {calibrator.epsilon}")
    print()

    header = f"{'Model':25s} {'Samples':>8s} {'MAE (°C)':>10s} {'RMSE (°C)':>10s} {'Weight':>10s}"
    print(header)
    print("-" * len(header))

    for model_name in MODEL_REGISTRY:
        n = sample_counts.get(model_name, 0)
        mae = maes.get(model_name)
        rmse = rmses.get(model_name)
        w = weights.get(model_name)
        mae_s = f"{mae:.4f}" if mae is not None else "N/A"
        rmse_s = f"{rmse:.4f}" if rmse is not None else "N/A"
        w_s = f"{w:.4f} ({w*100:.1f}%)" if w is not None else "EXCLUDED"
        print(f"  {model_name:25s} {n:8d} {mae_s:>10s} {rmse_s:>10s} {w_s:>18s}")

    weight_sum = sum(weights.values())
    print(f"\n  Weight sum: {weight_sum:.6f}")

    # ── Step 6: Save to calibration_90d.json ─────────────────────────────────
    calibrated_at = dt.datetime.now(dt.timezone.utc).isoformat()
    meta_90d = CalibrationMetadata(
        calibrated_at=calibrated_at,
        evaluation_period=f"{start_date} to {end_date}",
        lead_time="+24h",
        location=f"{LOCATION} ({LATITUDE:.2f}°N, {LONGITUDE:.2f}°E)",
        latitude=LATITUDE,
        longitude=LONGITUDE,
        reference_dataset="ERA5 Reanalysis (Open-Meteo Archive API)",
        metric="MAE",
        sample_counts=sample_counts,
        mae=maes,
        rmse=rmses,
        weights=weights,
        epsilon=calibrator.epsilon,
        weighting_scheme="inverse-MAE skill: 1 / (MAE + epsilon)",
        total_eval_samples=total_ref,
        is_valid=len(weights) > 0,
    )

    HistoricalSkillCalibrator.save_calibration(meta_90d, OUTPUT_FILE)
    print(f"\n  ✓ Saved 90-day calibration to: {OUTPUT_FILE}")

    # ── Step 7: 30-day vs 90-day comparison ──────────────────────────────────
    print("\n" + "=" * 80)
    print("30-DAY vs 90-DAY COMPARISON")
    print("=" * 80)

    meta_30d = HistoricalSkillCalibrator.load_calibration(EXISTING_30D)
    if meta_30d is None:
        print("  ⚠ Could not load existing 30-day calibration for comparison.")
    else:
        print(f"  30-day period: {meta_30d.evaluation_period}")
        print(f"  90-day period: {start_date} to {end_date}")
        print()

        header2 = f"{'Model':25s} {'30d MAE':>10s} {'90d MAE':>10s} {'30d Wt':>10s} {'90d Wt':>10s} {'30d N':>8s} {'90d N':>8s}"
        print(header2)
        print("-" * len(header2))

        for model_name in MODEL_REGISTRY:
            mae_30 = meta_30d.mae.get(model_name)
            mae_90 = maes.get(model_name)
            w_30 = meta_30d.weights.get(model_name)
            w_90 = weights.get(model_name)
            n_30 = meta_30d.sample_counts.get(model_name, 0)
            n_90 = sample_counts.get(model_name, 0)

            mae_30_s = f"{mae_30:.4f}" if mae_30 is not None else "N/A"
            mae_90_s = f"{mae_90:.4f}" if mae_90 is not None else "N/A"
            w_30_s = f"{w_30*100:.1f}%" if w_30 is not None else "N/A"
            w_90_s = f"{w_90*100:.1f}%" if w_90 is not None else "N/A"

            print(f"  {model_name:25s} {mae_30_s:>10s} {mae_90_s:>10s} {w_30_s:>10s} {w_90_s:>10s} {n_30:>8d} {n_90:>8d}")

    # ── Step 8: Data limitations report ──────────────────────────────────────
    print("\n" + "=" * 80)
    print("DATA AVAILABILITY & LIMITATIONS")
    print("=" * 80)

    models_with_data = [m for m in MODEL_REGISTRY if m in weights]
    models_without = [m for m in MODEL_REGISTRY if m not in weights]

    print(f"  Models with valid calibration : {len(models_with_data)}/4")
    for m in models_with_data:
        print(f"    ✓ {m} ({sample_counts.get(m, 0)} samples)")
    if models_without:
        print(f"  Models WITHOUT calibration    : {len(models_without)}/4")
        for m in models_without:
            print(f"    ✗ {m} ({sample_counts.get(m, 0)} samples — below minimum {MIN_SAMPLES_PER_MODEL})")

    print(f"\n  All four models have comparable 90-day data: {'YES' if len(models_with_data) == 4 else 'NO'}")
    print(f"  Production blending switched to 90-day: NO (Stage 2 — evaluation only)")
    print(f"  Existing 30-day calibration.json modified: NO")
    print()


if __name__ == "__main__":
    main()
