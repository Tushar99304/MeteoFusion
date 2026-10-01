"""
calibration.py — Historical Skill Calibration Layer for Multi-Model Blending (SIH26081 Phase 1).

Transparent, observation/reference-based historical skill calibration for +24h temperature forecasts.

Core Principles:
1. DATA LEAKAGE PROTECTION:
   Forecasts are retrieved from the Open-Meteo Previous Runs API with fixed lead-time offset
   `previous_day1` (+24h). This guarantees that every forecast evaluated was generated and issued
   at least 24 hours BEFORE the target valid time. Current or future forecast runs cannot leak
   into historical verification truth.
2. SAME-TIMESTAMP VERIFICATION:
   Forecast values are strictly evaluated against reference observations/reanalysis (ERA5) for the
   EXACT same valid UTC timestamp (fc_time == ref_time).
3. TRANSPARENT SKILL-TO-WEIGHT FORMULATION:
   MAE = mean(abs(model_forecast - reference_temperature))
   RMSE = sqrt(mean((model_forecast - reference_temperature)^2))
   skill_i = 1 / (MAE_i + epsilon)
   weight_i = skill_i / sum(all skill_i)
4. NO FABRICATION & EXCLUSION:
   If a model has fewer than `min_samples` valid matched points, it is excluded from calibration
   and remaining weights are renormalized. Scores are never invented or defaulted to zero.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import math
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import urllib.request
import urllib.error

from backend import config
from backend.models import (
    CalibrationMetadata,
    LeadTimeCalibrationProfile,
    LeadTimeCalibrationResult,
)

logger = logging.getLogger("meteofusion.calibration")


# Model display names mapped to Open-Meteo model identifiers
MODEL_REGISTRY: Dict[str, Dict[str, str]] = {
    "ECMWF IFS HRES": {
        "om_id": "ecmwf_ifs025",
        "hourly_key": "temperature_2m_previous_day1_ecmwf_ifs025",
        "type": "NWP",
    },
    "NCEP GFS": {
        "om_id": "gfs_seamless",
        "hourly_key": "temperature_2m_previous_day1_gfs_seamless",
        "type": "NWP",
    },
    "DWD ICON Global": {
        "om_id": "icon_seamless",
        "hourly_key": "temperature_2m_previous_day1_icon_seamless",
        "type": "NWP",
    },
    "ECMWF AIFS": {
        "om_id": "ecmwf_aifs025_single",
        "hourly_key": "temperature_2m_previous_day1_ecmwf_aifs025_single",
        "type": "AI/ML",
    },
}

# Lead time definitions mapped to Open-Meteo Previous Runs offset parameters
SUPPORTED_LEAD_TIMES: Dict[str, Dict[str, Any]] = {
    "24h": {
        "label": "+24h",
        "offset": "previous_day1",
        "lead_hours": 24,
    },
    "48h": {
        "label": "+48h",
        "offset": "previous_day2",
        "lead_hours": 48,
    },
    "72h": {
        "label": "+72h",
        "offset": "previous_day3",
        "lead_hours": 72,
    },
}


def normalize_lead_time_key(lead_time: str | int) -> str:
    """Normalizes lead time identifiers (e.g. '+24h', '24h', 24) to canonical '24h'."""
    if isinstance(lead_time, int):
        return f"{lead_time}h"
    s = str(lead_time).strip().lower().lstrip("+")
    if not s.endswith("h"):
        s = f"{s}h"
    return s


def get_model_hourly_key(model_name: str, lead_time: str | int = "24h") -> str:
    """Returns the Open-Meteo Previous Runs hourly key for a given model and lead time."""
    lt_key = normalize_lead_time_key(lead_time)
    if lt_key not in SUPPORTED_LEAD_TIMES:
        raise ValueError(
            f"Unsupported lead time '{lead_time}'. Supported: {list(SUPPORTED_LEAD_TIMES.keys())}"
        )
    offset = SUPPORTED_LEAD_TIMES[lt_key]["offset"]
    om_id = MODEL_REGISTRY[model_name]["om_id"]
    return f"temperature_2m_{offset}_{om_id}"


class HistoricalSkillCalibrator:

    """
    Manages evaluation of historical model skill against ERA5 reanalysis truth,
    converting forecast errors (MAE) into normalized calibration weights.
    """

    def __init__(
        self,
        previous_runs_url: Optional[str] = None,
        archive_url: Optional[str] = None,
        epsilon: Optional[float] = None,
        min_samples: Optional[int] = None,
    ):
        self.previous_runs_url = previous_runs_url or config.CALIBRATION_PREVIOUS_RUNS_URL
        self.archive_url = archive_url or config.CALIBRATION_ARCHIVE_URL
        self.epsilon = epsilon if epsilon is not None else config.CALIBRATION_EPSILON
        self.min_samples = min_samples if min_samples is not None else config.CALIBRATION_MIN_SAMPLES

    def resolve_date_window(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        window_days: Optional[int] = None,
    ) -> Tuple[str, str]:
        """
        Resolves start and end dates.
        ERA5 archive data typically has a 5-day publication latency.

        Priority order:
        1. Explicit start_date + end_date arguments (highest)
        2. Explicit window_days argument → dynamically computed from today
        3. Config CALIBRATION_START_DATE / CALIBRATION_END_DATE
        4. Config CALIBRATION_WINDOW_DAYS (default 30) → dynamically computed
        """
        if start_date and end_date:
            return start_date, end_date

        # If window_days is explicitly specified, compute dynamically (skip config dates)
        if window_days is not None:
            today = dt.date.today()
            ref_end = today - dt.timedelta(days=5)
            ref_start = ref_end - dt.timedelta(days=window_days - 1)
            return ref_start.isoformat(), ref_end.isoformat()

        cfg_start = config.CALIBRATION_START_DATE.strip()
        cfg_end = config.CALIBRATION_END_DATE.strip()
        if cfg_start and cfg_end:
            return cfg_start, cfg_end

        days = config.CALIBRATION_WINDOW_DAYS
        # Anchor end_date to 5 days ago to ensure complete ERA5 reanalysis coverage
        today = dt.date.today()
        ref_end = today - dt.timedelta(days=5)
        ref_start = ref_end - dt.timedelta(days=days - 1)
        return ref_start.isoformat(), ref_end.isoformat()

    def fetch_json(self, url: str) -> Dict[str, Any]:
        """Fetches and decodes JSON from a URL with polite User-Agent."""
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MeteoFusion-SkillCalibration/1.0 (SIH26081 Meteorological Calibration)"
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def fetch_forecast_data(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """
        Fetches fixed-lead-time (+24h / previous_day1) forecasts for all registered models.
        DATA LEAKAGE NOTE:
        The `previous_day1` parameter ensures the forecast was initialized exactly 24 hours
        prior to each target timestamp.
        """
        models_param = ",".join(reg["om_id"] for reg in MODEL_REGISTRY.values())
        url = (
            f"{self.previous_runs_url}?"
            f"latitude={latitude}&longitude={longitude}&"
            f"hourly=temperature_2m_previous_day1&"
            f"models={models_param}&"
            f"start_date={start_date}&end_date={end_date}"
        )
        logger.info("Fetching previous runs from: %s", url)
        return self.fetch_json(url)

    def fetch_forecast_data_multi_lead(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
        lead_times: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Fetches fixed-lead-time forecasts for specified lead times across all registered models.
        Uses Open-Meteo Previous Runs API:
          - +24h: temperature_2m_previous_day1
          - +48h: temperature_2m_previous_day2
          - +72h: temperature_2m_previous_day3
        """
        target_lts = lead_times or ["24h", "48h", "72h"]
        offsets = [
            SUPPORTED_LEAD_TIMES[normalize_lead_time_key(lt)]["offset"]
            for lt in target_lts
        ]
        hourly_vars = [f"temperature_2m_{offset}" for offset in offsets]
        hourly_param = ",".join(hourly_vars)
        models_param = ",".join(reg["om_id"] for reg in MODEL_REGISTRY.values())

        url = (
            f"{self.previous_runs_url}?"
            f"latitude={latitude}&longitude={longitude}&"
            f"hourly={hourly_param}&"
            f"models={models_param}&"
            f"start_date={start_date}&end_date={end_date}"
        )
        logger.info("Fetching multi-lead previous runs from: %s", url)
        return self.fetch_json(url)


    def fetch_reference_data(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """
        Fetches historical reference truth from Open-Meteo Archive API (ERA5 reanalysis).
        """
        url = (
            f"{self.archive_url}?"
            f"latitude={latitude}&longitude={longitude}&"
            f"hourly=temperature_2m&"
            f"start_date={start_date}&end_date={end_date}"
        )
        logger.info("Fetching ERA5 reference truth from: %s", url)
        return self.fetch_json(url)

    def calculate_errors_and_weights(
        self,
        forecast_data: Dict[str, Any],
        reference_data: Dict[str, Any],
    ) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, float], Dict[str, float], int]:
        """
        Strict timestamp matching and error calculation.

        Returns:
            (sample_counts, maes, rmses, weights, total_reference_points)
        """
        ref_hourly = reference_data.get("hourly", {})
        ref_times = ref_hourly.get("time", [])
        ref_temps = ref_hourly.get("temperature_2m", [])

        if not ref_times or not ref_temps:
            raise ValueError("Reference dataset contains no hourly temperature data.")

        # Build reference lookup map by ISO timestamp: timestamp -> reference_temperature
        ref_map: Dict[str, float] = {}
        for t, temp in zip(ref_times, ref_temps):
            if temp is not None:
                ref_map[t] = float(temp)

        total_ref_points = len(ref_map)

        fc_hourly = forecast_data.get("hourly", {})
        fc_times = fc_hourly.get("time", [])

        sample_counts: Dict[str, int] = {}
        maes: Dict[str, float] = {}
        rmses: Dict[str, float] = {}
        skills: Dict[str, float] = {}

        for model_name, meta in MODEL_REGISTRY.items():
            key = meta["hourly_key"]
            fc_values = fc_hourly.get(key, [])

            # Strictly match only points with identical timestamp and non-null values
            diffs: List[float] = []
            for t, fc_val in zip(fc_times, fc_values):
                if fc_val is not None and t in ref_map:
                    ref_val = ref_map[t]
                    diffs.append(abs(float(fc_val) - ref_val))

            n_samples = len(diffs)
            sample_counts[model_name] = n_samples

            # Exclude model if insufficient valid matched samples
            if n_samples < self.min_samples:
                logger.warning(
                    "Model %s has %d samples (minimum %d required); excluded from calibration.",
                    model_name,
                    n_samples,
                    self.min_samples,
                )
                continue

            # Calculate MAE and RMSE
            mae = sum(diffs) / n_samples
            rmse = math.sqrt(sum(d * d for d in diffs) / n_samples)
            maes[model_name] = round(mae, 4)
            rmses[model_name] = round(rmse, 4)

            # Skill = 1 / (MAE + epsilon)
            skill = 1.0 / (mae + self.epsilon)
            skills[model_name] = skill

        # Normalize skill into weights summing to 1.0
        weights: Dict[str, float] = {}
        total_skill = sum(skills.values())

        if total_skill > 0:
            for model_name, s in skills.items():
                weights[model_name] = round(s / total_skill, 4)

            # Eliminate any residual float rounding discrepancy
            w_sum = sum(weights.values())
            if abs(w_sum - 1.0) > 1e-6 and weights:
                # Adjust highest weight model by the residual
                highest_model = max(weights, key=lambda k: weights[k])
                weights[highest_model] = round(weights[highest_model] + (1.0 - w_sum), 4)

        return sample_counts, maes, rmses, weights, total_ref_points

    def calculate_errors_and_weights_for_lead_time(
        self,
        forecast_data: Dict[str, Any],
        reference_data: Dict[str, Any],
        lead_time: str | int = "24h",
    ) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, float], Dict[str, float], Dict[str, float], int]:
        """
        Strict timestamp matching and error calculation for a specific lead time (+24h, +48h, +72h).

        Returns:
            (sample_counts, maes, rmses, skills, weights, total_reference_points)
        """
        ref_hourly = reference_data.get("hourly", {})
        ref_times = ref_hourly.get("time", [])
        ref_temps = ref_hourly.get("temperature_2m", [])

        if not ref_times or not ref_temps:
            raise ValueError("Reference dataset contains no hourly temperature data.")

        ref_map: Dict[str, float] = {}
        for t, temp in zip(ref_times, ref_temps):
            if temp is not None:
                ref_map[t] = float(temp)

        total_ref_points = len(ref_map)

        fc_hourly = forecast_data.get("hourly", {})
        fc_times = fc_hourly.get("time", [])

        sample_counts: Dict[str, int] = {}
        maes: Dict[str, float] = {}
        rmses: Dict[str, float] = {}
        skills: Dict[str, float] = {}

        lt_canonical = normalize_lead_time_key(lead_time)

        for model_name, meta in MODEL_REGISTRY.items():
            key = get_model_hourly_key(model_name, lt_canonical)
            fc_values = fc_hourly.get(key)
            if fc_values is None and lt_canonical == "24h":
                fc_values = fc_hourly.get(meta.get("hourly_key", ""))
            if fc_values is None:
                fc_values = []

            # Strictly match only points with identical timestamp and non-null values
            diffs: List[float] = []
            for t, fc_val in zip(fc_times, fc_values):
                if fc_val is not None and t in ref_map:
                    ref_val = ref_map[t]
                    diffs.append(abs(float(fc_val) - ref_val))

            n_samples = len(diffs)
            sample_counts[model_name] = n_samples

            # Exclude model if insufficient valid matched samples
            if n_samples < self.min_samples:
                logger.warning(
                    "Model %s at lead time %s has %d samples (minimum %d required); excluded from calibration.",
                    model_name,
                    lt_canonical,
                    n_samples,
                    self.min_samples,
                )
                continue

            # Calculate MAE and RMSE
            mae = sum(diffs) / n_samples
            rmse = math.sqrt(sum(d * d for d in diffs) / n_samples)
            maes[model_name] = round(mae, 4)
            rmses[model_name] = round(rmse, 4)

            # Skill = 1 / (MAE + epsilon)
            skill = 1.0 / (mae + self.epsilon)
            skills[model_name] = round(skill, 4)

        # Normalize skill into weights summing to 1.0
        weights: Dict[str, float] = {}
        total_skill = sum(skills.values())

        if total_skill > 0:
            for model_name, s in skills.items():
                weights[model_name] = round(s / total_skill, 4)

            # Eliminate any residual float rounding discrepancy
            w_sum = sum(weights.values())
            if abs(w_sum - 1.0) > 1e-6 and weights:
                highest_model = max(weights, key=lambda k: weights[k])
                weights[highest_model] = round(weights[highest_model] + (1.0 - w_sum), 4)

        return sample_counts, maes, rmses, skills, weights, total_ref_points

    def run_calibration(

        self,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        location_name: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        save_path: Optional[str] = None,
    ) -> CalibrationMetadata:
        """
        Runs full historical calibration against live Open-Meteo Previous Runs and ERA5 archive.
        """
        lat = latitude if latitude is not None else config.CALIBRATION_LATITUDE
        lon = longitude if longitude is not None else config.CALIBRATION_LONGITUDE
        loc_name = location_name or config.CALIBRATION_LOCATION_NAME

        s_date, e_date = self.resolve_date_window(start_date, end_date)

        fc_data = self.fetch_forecast_data(lat, lon, s_date, e_date)
        ref_data = self.fetch_reference_data(lat, lon, s_date, e_date)

        sample_counts, maes, rmses, weights, total_ref_points = self.calculate_errors_and_weights(
            fc_data, ref_data
        )

        calibrated_at = dt.datetime.now(dt.timezone.utc).isoformat()
        metadata = CalibrationMetadata(
            calibrated_at=calibrated_at,
            evaluation_period=f"{s_date} to {e_date}",
            lead_time="+24h",
            location=f"{loc_name} ({lat:.2f}°N, {lon:.2f}°E)",
            latitude=lat,
            longitude=lon,
            reference_dataset="ERA5 Reanalysis (Open-Meteo Archive API)",
            metric="MAE",
            sample_counts=sample_counts,
            mae=maes,
            rmse=rmses,
            weights=weights,
            epsilon=self.epsilon,
            weighting_scheme="inverse-MAE skill: 1 / (MAE + epsilon)",
            total_eval_samples=total_ref_points,
            is_valid=len(weights) > 0,
        )

        if save_path is not False:
            target_file = save_path or config.CALIBRATION_FILE_PATH
            self.save_calibration(metadata, target_file)

        return metadata

    @staticmethod
    def save_calibration(metadata: CalibrationMetadata, file_path: str) -> None:
        """Saves CalibrationMetadata to JSON file."""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(metadata.model_dump_json(indent=2))
        logger.info("Saved calibration metadata to %s", path)

    @staticmethod
    def load_calibration(file_path: Optional[str] = None) -> Optional[CalibrationMetadata]:
        """Loads and parses CalibrationMetadata from JSON file, returning None on failure."""
        target = file_path or config.CALIBRATION_FILE_PATH
        path = Path(target)
        if not path.is_file():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return CalibrationMetadata(**data)
        except Exception as e:
            logger.warning("Failed to load calibration from %s: %s", target, e)
            return None

    def run_lead_time_calibration(
        self,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        location_name: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        window_days: Optional[int] = None,
        lead_times: Optional[List[str]] = None,
        save_path: Optional[str] = None,
    ) -> LeadTimeCalibrationResult:
        """
        Runs multi-lead-time (+24h, +48h, +72h) historical calibration against
        Open-Meteo Previous Runs and ERA5 archive.
        """
        lat = latitude if latitude is not None else config.CALIBRATION_LATITUDE
        lon = longitude if longitude is not None else config.CALIBRATION_LONGITUDE
        loc_name = location_name or config.CALIBRATION_LOCATION_NAME

        s_date, e_date = self.resolve_date_window(start_date, end_date, window_days=window_days)
        target_lts = lead_times or ["24h", "48h", "72h"]

        fc_data = self.fetch_forecast_data_multi_lead(lat, lon, s_date, e_date, target_lts)
        ref_data = self.fetch_reference_data(lat, lon, s_date, e_date)

        calibrated_at = dt.datetime.now(dt.timezone.utc).isoformat()
        profiles: Dict[str, LeadTimeCalibrationProfile] = {}

        for lt in target_lts:
            lt_key = normalize_lead_time_key(lt)
            meta_lt = SUPPORTED_LEAD_TIMES[lt_key]
            counts, maes, rmses, skills, weights, total_pts = (
                self.calculate_errors_and_weights_for_lead_time(
                    fc_data, ref_data, lead_time=lt_key
                )
            )
            profile = LeadTimeCalibrationProfile(
                lead_time=meta_lt["label"],
                offset_parameter=meta_lt["offset"],
                sample_counts=counts,
                mae=maes,
                rmse=rmses,
                skill=skills,
                weights=weights,
                total_eval_samples=total_pts,
                is_valid=len(weights) > 0,
            )
            profiles[lt_key] = profile

        result = LeadTimeCalibrationResult(
            region=loc_name,
            location=f"{loc_name} ({lat:.2f}°N, {lon:.2f}°E)",
            latitude=lat,
            longitude=lon,
            variable="temperature",
            evaluation_period=f"{s_date} to {e_date}",
            reference_dataset="ERA5 Reanalysis (Open-Meteo Archive API)",
            metric="MAE",
            epsilon=self.epsilon,
            weighting_scheme="inverse-MAE skill: 1 / (MAE + epsilon)",
            calibrated_at=calibrated_at,
            lead_times=profiles,
        )

        if save_path is not False:
            target_file = save_path or config.CALIBRATION_LEADTIMES_FILE_PATH
            self.save_lead_time_calibration(result, target_file)

        return result

    @staticmethod
    def save_lead_time_calibration(result: LeadTimeCalibrationResult, file_path: str) -> None:
        """Saves LeadTimeCalibrationResult to JSON file."""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(result.model_dump_json(indent=2))
        logger.info("Saved lead-time calibration to %s", path)

    @staticmethod
    def load_lead_time_calibration(file_path: Optional[str] = None) -> Optional[LeadTimeCalibrationResult]:
        """Loads and parses LeadTimeCalibrationResult from JSON file, returning None on failure."""
        target = file_path or config.CALIBRATION_LEADTIMES_FILE_PATH
        path = Path(target)
        if not path.is_file():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return LeadTimeCalibrationResult(**data)
        except Exception as e:
            logger.warning("Failed to load lead-time calibration from %s: %s", target, e)
            return None

    @staticmethod
    def is_applicable(
        meta: Optional[CalibrationMetadata],
        region: str,
        lead_time_hours: Optional[int] = None,
    ) -> bool:
        """
        Determines whether the calibration result is applicable to the current forecast query.
        Phase 1 applies calibration for:
        - Region: Mumbai (name match or within coordinate proximity ~1.5°)
        - Lead time: +24h (accepts range 20h - 28h)
        """
        if not meta or not meta.is_valid or not meta.weights:
            return False

        # Lead time matching: Phase 1 is calibrated for +24h
        if lead_time_hours is not None:
            if not (20 <= lead_time_hours <= 28):
                return False

        r_lower = region.lower().strip()
        if "mumbai" in r_lower or "bombay" in r_lower:
            return True

        # Check coordinate proximity if region string has coordinates "lat, lon"
        try:
            parts = [float(p.strip()) for p in region.split(",") if p.strip()]
            if len(parts) == 2:
                lat, lon = parts[0], parts[1]
                calib_lat = meta.latitude if meta.latitude is not None else 19.0760
                calib_lon = meta.longitude if meta.longitude is not None else 72.8777
                if abs(lat - calib_lat) <= 1.5 and abs(lon - calib_lon) <= 1.5:
                    return True
        except Exception:
            pass

        return False
