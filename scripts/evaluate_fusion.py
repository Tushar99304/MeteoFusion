"""
evaluate_fusion.py - Evaluation framework to compare Open-Meteo baseline with Multi-Source Fusion.

Usage:
  python scripts/evaluate_fusion.py

This script evaluates whether multi-source weighted fusion improves forecast reliability
compared to an Open-Meteo-only baseline.

PHASE 4 NOTE: GROUND TRUTH
This script currently lacks access to a dedicated ground-truth observation API (e.g., IMD
station observations or a paid historical actuals API).
For the purpose of demonstrating the evaluation pipeline, it uses Open-Meteo's Archive API
(reanalysis data) as a PROXY for ground truth.
DO NOT present these numbers as definitive real-world accuracy until real station
observation data is plugged into `get_ground_truth()`.
"""

import asyncio
import os
import datetime as dt
from typing import List, Dict, Tuple, Optional

from backend import config
from backend.services.weather import OpenMeteoProvider
from backend.services.providers.fused import FusedWeatherProvider
from backend.services.providers.openweathermap import OpenWeatherMapProvider
from backend.services.providers.tomorrowio import TomorrowIoProvider

# Test locations: (lat, lon, name)
LOCATIONS = [
    (18.5204, 73.8567, "Pune, India"),
    (28.6139, 77.2090, "New Delhi, India"),
    (19.0760, 72.8777, "Mumbai, India"),
    (13.0827, 80.2707, "Chennai, India"),
    (22.5726, 88.3639, "Kolkata, India"),
]

def calc_mae(predictions: List[float], actuals: List[float]) -> Optional[float]:
    if not predictions or not actuals or len(predictions) != len(actuals):
        return None
    errors = [abs(p - a) for p, a in zip(predictions, actuals)]
    return sum(errors) / len(errors)

def calc_rmse(predictions: List[float], actuals: List[float]) -> Optional[float]:
    if not predictions or not actuals or len(predictions) != len(actuals):
        return None
    errors_sq = [(p - a) ** 2 for p, a in zip(predictions, actuals)]
    return (sum(errors_sq) / len(errors_sq)) ** 0.5

async def get_ground_truth(lat: float, lon: float, date_str: str) -> Optional[float]:
    """
    Retrieves ground truth temperature for a specific date.
    Currently uses Open-Meteo Archive (reanalysis) as a proxy.
    To be replaced with IMD/station observations for real evaluation.
    """
    om_provider = OpenMeteoProvider()
    try:
        truth_bundle = await om_provider.fetch(lat, lon, timeframe="past", target_date=date_str)
        if truth_bundle.past_days:
            return truth_bundle.past_days[0].temperature_max_c
    except Exception:
        pass
    return None

async def fetch_provider_prediction(provider, lat, lon) -> Optional[float]:
    try:
        bundle = await provider.fetch(lat, lon, timeframe="now")
        return bundle.current.temperature_c if bundle.current else None
    except Exception:
        return None

async def evaluate():
    print("==================================================")
    print(" MULTI-SOURCE FUSION EVALUATION FRAMEWORK")
    print("==================================================\n")
    
    # Check API availability
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY")
    tom_key = os.getenv("TOMORROW_IO_API_KEY")
    
    available_providers = ["open-meteo"]
    if owm_key: available_providers.append("openweathermap")
    if tom_key: available_providers.append("tomorrowio")
    
    print("PHASE 2: API AVAILABILITY")
    print(f"Available Providers: {', '.join(available_providers)}")
    if not owm_key or not tom_key:
        print("WARNING: Missing API keys for OpenWeatherMap and/or Tomorrow.io.")
        print("Real live 3-source evaluation cannot be performed.")
        print("Accuracy improvement has not yet been demonstrated.\n")
        return
        
    print("\nPHASE 6: WEIGHT EVALUATION (Deriving Reliability Weights)")
    print("Collecting historical forecast errors for each provider...")
    # In a real scenario, this would loop over past 30 days.
    # Here, we simulate the structure of weight derivation.
    
    # Dummy historical MAEs for demonstration of weight derivation math
    historical_mae = {
        "open-meteo": 1.2,
        "openweathermap": 1.5,
        "tomorrowio": 1.1
    }
    print(f"Historical MAEs (simulated for demo): {historical_mae}")
    
    # Inverse MAE weighting: lower error -> higher weight
    total_inv_mae = sum(1.0 / mae for mae in historical_mae.values())
    derived_weights = {
        k: (1.0 / mae) / total_inv_mae * 3.0 # Normalize to sum to 3.0 for comparability
        for k, mae in historical_mae.items()
    }
    
    print("Derived Reliability Weights:")
    for k, w in derived_weights.items():
        print(f"  {k}: {w:.2f}")
        
    print("\nPHASE 3 & 5: REAL EVALUATION (Testing Weights on New Data)")
    
    om_provider = OpenMeteoProvider()
    
    # 1. Equal-Weight Fusion
    config.FUSION_WEIGHT_OPEN_METEO = 1.0
    config.FUSION_WEIGHT_OPENWEATHER = 1.0
    config.FUSION_WEIGHT_TOMORROWIO = 1.0
    equal_fusion_provider = FusedWeatherProvider()
    
    # 2. Reliability-Weighted Fusion
    config.FUSION_WEIGHT_OPEN_METEO = derived_weights.get("open-meteo", 1.0)
    config.FUSION_WEIGHT_OPENWEATHER = derived_weights.get("openweathermap", 1.0)
    config.FUSION_WEIGHT_TOMORROWIO = derived_weights.get("tomorrowio", 1.0)
    rel_fusion_provider = FusedWeatherProvider()
    
    results = {
        "baseline_preds": [],
        "equal_fused_preds": [],
        "rel_fused_preds": [],
        "actuals": [],
        "disagreements": 0,
        "outliers_handled": 0
    }
    
    yesterday = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).strftime("%Y-%m-%d")
    
    for lat, lon, name in LOCATIONS:
        truth = await get_ground_truth(lat, lon, yesterday)
        if truth is None:
            continue
            
        base_val = await fetch_provider_prediction(om_provider, lat, lon)
        
        try:
            eq_bundle = await equal_fusion_provider.fetch(lat, lon, timeframe="now")
            eq_val = eq_bundle.current.temperature_c if eq_bundle.current else None
            
            rel_bundle = await rel_fusion_provider.fetch(lat, lon, timeframe="now")
            rel_val = rel_bundle.current.temperature_c if rel_bundle.current else None
            
            if base_val is not None and eq_val is not None and rel_val is not None:
                results["baseline_preds"].append(base_val)
                results["equal_fused_preds"].append(eq_val)
                results["rel_fused_preds"].append(rel_val)
                results["actuals"].append(truth)
                
                if eq_bundle.disagreement_flag:
                    results["disagreements"] += 1
                if eq_bundle.source_agreement == "Moderate Agreement": # Proxy for outlier drop
                    results["outliers_handled"] += 1
        except Exception as e:
            print(f"Error evaluating {name}: {e}")
            
    print("\n--- Evaluation Summary ---")
    samples = len(results["actuals"])
    print(f"Samples evaluated: {samples}")
    if samples > 0:
        base_mae = calc_mae(results["baseline_preds"], results["actuals"])
        base_rmse = calc_rmse(results["baseline_preds"], results["actuals"])
        
        eq_mae = calc_mae(results["equal_fused_preds"], results["actuals"])
        eq_rmse = calc_rmse(results["equal_fused_preds"], results["actuals"])
        
        rel_mae = calc_mae(results["rel_fused_preds"], results["actuals"])
        rel_rmse = calc_rmse(results["rel_fused_preds"], results["actuals"])
        
        print(f"Baseline (Open-Meteo) MAE:      {base_mae:.2f}°C, RMSE: {base_rmse:.2f}°C")
        print(f"Equal-Weight Fusion MAE:        {eq_mae:.2f}°C, RMSE: {eq_rmse:.2f}°C")
        print(f"Reliability-Weight Fusion MAE:  {rel_mae:.2f}°C, RMSE: {rel_rmse:.2f}°C")
        
        disagree_pct = (results["disagreements"] / samples) * 100
        outlier_pct = (results["outliers_handled"] / samples) * 100
        print(f"Disagreement frequency: {disagree_pct:.1f}%")
        print(f"Outlier handling frequency: {outlier_pct:.1f}%")
        
        if rel_mae < base_mae:
            print("\nResult: Measured evidence of improvement with reliability-weighted fusion.")
        else:
            print("\nResult: Accuracy improvement has not yet been demonstrated.")
    else:
        print("No samples could be evaluated.")
        
if __name__ == "__main__":
    asyncio.run(evaluate())
