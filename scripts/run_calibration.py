"""
scripts/run_calibration.py — CLI tool to run historical skill calibration for Mumbai +24h.

Executes live Open-Meteo Previous Runs and ERA5 Archive queries, calculates MAE and
skill-calibrated weights, stores structured results to calibration.json, and prints
the verification table for SIH evaluation.
"""

import sys
import os

# Add repository root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.calibration import HistoricalSkillCalibrator


def main():
    print("=" * 70)
    print("MeteoFusion / SIH26081 — Historical Skill Calibration Engine")
    print("=" * 70)
    print("Target: Mumbai | Lead time: +24h (previous_day1) | Metric: MAE | Ref: ERA5")
    print("Connecting to Open-Meteo Previous Runs & ERA5 Archive APIs...")

    calibrator = HistoricalSkillCalibrator()
    meta = calibrator.run_calibration()

    print("\nCalibration successfully computed and saved to calibration.json!\n")
    print(f"Location:           {meta.location}")
    print(f"Evaluation Period:  {meta.evaluation_period}")
    print(f"Lead Time:          {meta.lead_time}")
    print(f"Reference Truth:    {meta.reference_dataset}")
    print(f"Metric:             {meta.metric}")
    print(f"Weighting Scheme:   {meta.weighting_scheme} (epsilon={meta.epsilon})")
    print(f"Total Ref Samples:  {meta.total_eval_samples}")
    print(f"Calibrated At:      {meta.calibrated_at}")
    print("\n" + "-" * 70)
    print(f"{'Model':<18} | {'Samples':<8} | {'MAE':<9} | {'RMSE':<9} | {'Weight':<8}")
    print("-" * 70)

    for model_name in ["ECMWF IFS HRES", "NCEP GFS", "DWD ICON Global", "ECMWF AIFS"]:
        samples = meta.sample_counts.get(model_name, 0)
        mae = meta.mae.get(model_name)
        mae_str = f"{mae:.3f} °C" if mae is not None else "N/A"
        rmse = meta.rmse.get(model_name) if meta.rmse else None
        rmse_str = f"{rmse:.3f} °C" if rmse is not None else "N/A"
        w = meta.weights.get(model_name)
        w_str = f"{w * 100:.1f}%" if w is not None else "0.0%"
        print(f"{model_name:<18} | {samples:<8} | {mae_str:<9} | {rmse_str:<9} | {w_str:<8}")

    print("-" * 70)
    total_w = sum(meta.weights.values())
    print(f"Sum of Weights: {total_w * 100:.1f}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
