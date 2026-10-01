"""
test_missing_model_blending.py — Unit tests for ModelBlendingEngine missing-model handling.

Tests verify that:
  - A model with all-None variables gets weight 0.
  - The remaining valid models have their weights renormalized correctly.
  - Blended values are mathematically correct (only valid models contribute).
"""
import pytest
from backend.models import ModelForecast
from backend.services.blending import ModelBlendingEngine


def test_missing_model_blending_3_models():
    """3-model scenario: ECMWF missing all data → GFS/ICON get 50% each."""
    engine = ModelBlendingEngine()

    m1 = ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                       temperature_c=None, precipitation_mm=None, wind_speed_kmh=None)
    m2 = ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                       temperature_c=33.0, precipitation_mm=5.0, wind_speed_kmh=20.0)
    m3 = ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                       temperature_c=30.0, precipitation_mm=0.0, wind_speed_kmh=10.0)

    metadata = engine.blend([m1, m2, m3], region="Test Region")

    assert metadata.models[0].weight == 0.0     # ECMWF — no data
    assert abs(metadata.models[1].weight - 0.5) < 0.01  # GFS
    assert abs(metadata.models[2].weight - 0.5) < 0.01  # ICON

    # Blended temperature = (33 + 30) / 2 = 31.5
    assert metadata.blended_temperature_c == 31.5
    assert metadata.blended_precipitation_mm == 2.5
    assert metadata.blended_wind_speed_kmh == 15.0


def test_missing_model_blending_4_models_aifs_missing():
    """4-model scenario: AIFS missing all data → 3 NWP models get ~33.3% each."""
    engine = ModelBlendingEngine()

    m1 = ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                       temperature_c=24.0, precipitation_mm=2.0, wind_speed_kmh=10.0)
    m2 = ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                       temperature_c=27.0, precipitation_mm=3.0, wind_speed_kmh=15.0)
    m3 = ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                       temperature_c=21.0, precipitation_mm=1.0, wind_speed_kmh=5.0)
    m4 = ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0,
                       temperature_c=None, precipitation_mm=None, wind_speed_kmh=None)

    metadata = engine.blend([m1, m2, m3, m4], region="Test Region")

    # AIFS must get weight 0
    aifs = next(m for m in metadata.models if m.model_name == "ECMWF AIFS")
    assert aifs.weight == 0.0

    # The 3 NWP models must share weight equally
    nwp = [m for m in metadata.models if m.model_name != "ECMWF AIFS"]
    for m in nwp:
        assert abs(m.weight - 1/3) < 1e-6, f"{m.model_name}: {m.weight}"

    # Blended values from 3 NWP models only
    expected_temp = (24.0 + 27.0 + 21.0) / 3  # 24.0
    expected_precip = (2.0 + 3.0 + 1.0) / 3   # 2.0
    expected_wind = (10.0 + 15.0 + 5.0) / 3   # 10.0

    assert abs(metadata.blended_temperature_c - expected_temp) < 0.05
    assert abs(metadata.blended_precipitation_mm - expected_precip) < 0.05
    assert abs(metadata.blended_wind_speed_kmh - expected_wind) < 0.05


def test_all_four_models_valid_equal_weights():
    """4 valid models → each gets 25 % in Normal regime."""
    engine = ModelBlendingEngine()

    models = [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                      temperature_c=20.0, precipitation_mm=1.0, wind_speed_kmh=8.0),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                      temperature_c=24.0, precipitation_mm=3.0, wind_speed_kmh=12.0),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                      temperature_c=28.0, precipitation_mm=5.0, wind_speed_kmh=16.0),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0,
                      temperature_c=32.0, precipitation_mm=7.0, wind_speed_kmh=20.0),
    ]

    metadata = engine.blend(models, region="Test Region", lead_time_hours=24)

    for m in metadata.models:
        assert abs(m.weight - 0.25) < 1e-9, f"{m.model_name}: {m.weight}"

    # Equal weights → simple arithmetic means
    expected_temp   = (20.0 + 24.0 + 28.0 + 32.0) / 4  # 26.0
    expected_precip = (1.0 + 3.0 + 5.0 + 7.0) / 4       # 4.0
    expected_wind   = (8.0 + 12.0 + 16.0 + 20.0) / 4    # 14.0

    assert abs(metadata.blended_temperature_c - expected_temp) < 0.05
    assert abs(metadata.blended_precipitation_mm - expected_precip) < 0.05
    assert abs(metadata.blended_wind_speed_kmh - expected_wind) < 0.05
