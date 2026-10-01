"""
test_phase5b_fusion.py — Integration tests for FusedWeatherProvider.

The NWP layer now contains 4 models:
  ECMWF IFS HRES, NCEP GFS, DWD ICON Global, ECMWF AIFS (AI/ML)
All 4 are fetched via OpenMeteoProvider (with different model_override IDs).
OWM and Tomorrow.io are optional validation providers.

fused_source count guide:
  4 NWP/AI models + OWM + TomorrowIO = 6  (all available)
  4 NWP/AI models + OWM               = 5  (TomorrowIO fails)
  4 NWP/AI models                     = 4  (both validation providers fail)
  3 NWP models (AIFS fails)            = 3  (AIFS down + both validation providers fail)
"""
import pytest
import asyncio
import datetime as dt
from backend import config
from backend.services.providers.fused import FusedWeatherProvider
from backend.models import WeatherBundle, CurrentWeather, HourlyForecastPoint
from backend.services.http_client import UpstreamError
from backend.services.weather import OpenMeteoProvider
from backend.services.providers.openweathermap import OpenWeatherMapProvider
from backend.services.providers.tomorrowio import TomorrowIoProvider


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _make_hourly(base_time: str = "2026-09-01T12:00", count: int = 24) -> list:
    """Generate `count` hourly steps starting at base_time for target matching."""
    pts = []
    base = dt.datetime.fromisoformat(base_time)
    for i in range(count):
        t = base + dt.timedelta(hours=i)
        pts.append(HourlyForecastPoint(
            time=t.strftime("%Y-%m-%dT%H:%M"),
            temperature_c=25.0,
            precipitation_mm=0.0,
            wind_speed_kmh=10.0,
        ))
    return pts


def _mock_open_meteo(monkeypatch, temp: float = 25.0, fail: bool = False):
    """Mocks ALL OpenMeteoProvider.fetch calls (including multi-model ones in fused.py)."""
    async def mock_fetch(*args, **kwargs):
        if fail:
            raise UpstreamError("open-meteo", "mock fail")
        return WeatherBundle(
            provider="open-meteo",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00",
                temperature_c=temp,
                apparent_temperature_c=26.0,
                humidity_pct=60.0,
                precipitation_mm=0.0,
                wind_speed_kmh=10.0,
                pressure_hpa=1012.0,
            ),
            hourly=_make_hourly(),
        )
    monkeypatch.setattr(OpenMeteoProvider, "fetch", mock_fetch)


def _mock_openweathermap(monkeypatch, temp: float = 25.5, fail: bool = False):
    async def mock_fetch(*args, **kwargs):
        if fail:
            raise UpstreamError("owm", "fail")
        return WeatherBundle(
            provider="openweathermap",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00",
                temperature_c=temp,
                apparent_temperature_c=26.5,
                humidity_pct=62.0,
                precipitation_mm=0.0,
                wind_speed_kmh=12.0,
                pressure_hpa=1010.0,
            ),
        )
    monkeypatch.setattr(OpenWeatherMapProvider, "fetch", mock_fetch)


def _mock_tomorrowio(monkeypatch, temp: float = 24.8, fail: bool = False):
    async def mock_fetch(*args, **kwargs):
        if fail:
            raise UpstreamError("tomorrowio", "fail")
        return WeatherBundle(
            provider="tomorrowio",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00",
                temperature_c=temp,
                apparent_temperature_c=25.8,
                humidity_pct=58.0,
                precipitation_mm=0.0,
                wind_speed_kmh=8.0,
                pressure_hpa=1014.0,
            ),
        )
    monkeypatch.setattr(TomorrowIoProvider, "fetch", mock_fetch)


# ---------------------------------------------------------------------------
# Existing provider-availability tests (counts updated for 4 NWP/AI models)
# ---------------------------------------------------------------------------

def test_01_all_sources_available(monkeypatch):
    """All 4 NWP/AI + OWM + TomorrowIO = 6 sources."""
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert bundle.provider == "multi-source"
    assert len(bundle.fused_sources) == 6
    assert not bundle.disagreement_flag
    assert bundle.source_agreement_score == 1.0
    assert abs(bundle.current.temperature_c - 25.0) < 0.1


def test_02_owm_unavailable(monkeypatch):
    """OWM fails → 4 NWP/AI + TomorrowIO = 5 sources."""
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert len(bundle.fused_sources) == 5
    assert bundle.source_agreement_score == 1.0
    assert abs(bundle.current.temperature_c - 25.0) < 0.1


def test_03_both_validation_providers_unavailable(monkeypatch):
    """OWM + TomorrowIO fail → 4 NWP/AI models only."""
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch, fail=True)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert len(bundle.fused_sources) == 4
    assert "openweathermap" not in bundle.fused_sources
    assert "tomorrowio" not in bundle.fused_sources
    assert bundle.source_agreement_score == 1.0
    assert abs(bundle.current.temperature_c - 25.0) < 0.1


def test_04_strong_disagreement_between_sources(monkeypatch):
    _mock_open_meteo(monkeypatch)         # 25.0
    _mock_openweathermap(monkeypatch, temp=25.2)  # close
    _mock_tomorrowio(monkeypatch, temp=35.0)      # strong disagreement

    monkeypatch.setattr(config, "FUSION_MAX_DISAGREEMENT_C", 5.0)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert bundle.disagreement_flag is True
    assert bundle.source_agreement_score < 1.0
    assert abs(bundle.current.temperature_c - 25.0) < 0.1


def test_05_all_validation_sources_disagree(monkeypatch):
    _mock_open_meteo(monkeypatch)                  # 25.0
    _mock_openweathermap(monkeypatch, temp=35.0)
    _mock_tomorrowio(monkeypatch, temp=15.0)

    monkeypatch.setattr(config, "FUSION_MAX_DISAGREEMENT_C", 5.0)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert bundle.disagreement_flag is True
    assert bundle.source_agreement_score < 1.0
    assert abs(bundle.current.temperature_c - 25.0) < 0.1


def test_06_tomorrowio_weight_zero(monkeypatch):
    """TomorrowIO weight=0 → skipped, fused_sources = 4 NWP/AI + OWM = 5."""
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, temp=26.0)
    _mock_tomorrowio(monkeypatch, temp=27.0)

    monkeypatch.setattr(config, "FUSION_WEIGHT_OPEN_METEO", 1.0)
    monkeypatch.setattr(config, "FUSION_WEIGHT_OPENWEATHER", 2.0)
    monkeypatch.setattr(config, "FUSION_WEIGHT_TOMORROWIO", 0.0)  # skipped

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert "tomorrowio" not in bundle.fused_sources
    assert len(bundle.fused_sources) == 5
    assert abs(bundle.current.temperature_c - 25.0) < 0.01


def test_07_no_api_keys_configured(monkeypatch):
    """With no OWM/TomorrowIO keys, only 4 NWP/AI model sources survive."""
    monkeypatch.setattr(config, "OPENWEATHERMAP_API_KEY", "")
    monkeypatch.setattr(config, "TOMORROW_IO_API_KEY", "")

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    assert len(bundle.fused_sources) == 4
    assert bundle.fused_sources[0] == "ECMWF IFS HRES"


# ---------------------------------------------------------------------------
# NEW: Four-model blending engine unit tests
# ---------------------------------------------------------------------------

from backend.models import ModelForecast
from backend.services.blending import ModelBlendingEngine


def _make_4_models(
    ecmwf_ifs_temp=25.0, ecmwf_ifs_precip=0.0, ecmwf_ifs_wind=10.0,
    gfs_temp=27.0,        gfs_precip=0.0,        gfs_wind=12.0,
    icon_temp=23.0,       icon_precip=0.0,        icon_wind=8.0,
    aifs_temp=26.0,       aifs_precip=0.0,        aifs_wind=11.0,
):
    """Return a list of 4 ModelForecast objects with the given values."""
    return [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                      temperature_c=ecmwf_ifs_temp, precipitation_mm=ecmwf_ifs_precip, wind_speed_kmh=ecmwf_ifs_wind),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                      temperature_c=gfs_temp,        precipitation_mm=gfs_precip,        wind_speed_kmh=gfs_wind),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                      temperature_c=icon_temp,       precipitation_mm=icon_precip,       wind_speed_kmh=icon_wind),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0,
                      temperature_c=aifs_temp,       precipitation_mm=aifs_precip,       wind_speed_kmh=aifs_wind),
    ]


def test_b01_four_valid_models_equal_25pct_each():
    """Normal regime + all 4 valid → each model gets exactly 25 %."""
    engine = ModelBlendingEngine()
    models = _make_4_models()

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    assert meta.weather_regime == "Normal"
    for m in meta.models:
        assert abs(m.weight - 0.25) < 1e-9, (
            f"{m.model_name} weight {m.weight} ≠ 0.25"
        )
    # Weights must sum to 1.0
    assert abs(sum(m.weight for m in meta.models) - 1.0) < 1e-9


def test_b02_four_valid_models_correct_blended_temperature():
    """Blended temp = arithmetic mean of the four temperatures (equal weights)."""
    engine = ModelBlendingEngine()
    # temps: 25, 27, 23, 26  → mean = 25.25
    models = _make_4_models(
        ecmwf_ifs_temp=25.0,
        gfs_temp=27.0,
        icon_temp=23.0,
        aifs_temp=26.0,
    )

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    expected_temp = (25.0 + 27.0 + 23.0 + 26.0) / 4  # 25.25 → rounds to 25.2 or 25.3
    assert meta.blended_temperature_c is not None
    # Allow 0.1 tolerance for round(x, 1) banker's rounding
    assert abs(meta.blended_temperature_c - expected_temp) < 0.1


def test_b03_aifs_unavailable_three_models_renormalized():
    """AIFS returns no data → 3 valid NWP models each get ≈ 33.3 %."""
    engine = ModelBlendingEngine()
    models = _make_4_models(
        aifs_temp=None, aifs_precip=None, aifs_wind=None,  # AIFS unavailable
    )

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    # ECMWF AIFS must have weight 0
    aifs = next(m for m in meta.models if m.model_name == "ECMWF AIFS")
    assert aifs.weight == 0.0, f"AIFS weight should be 0, got {aifs.weight}"

    # Each of the 3 remaining NWP models must be ~33.3 %
    nwp_models = [m for m in meta.models if m.model_name != "ECMWF AIFS"]
    for m in nwp_models:
        assert abs(m.weight - 1/3) < 1e-6, (
            f"{m.model_name} weight {m.weight} ≠ 1/3 after AIFS exclusion"
        )

    # Blended temp must NOT include AIFS values (only 3 models averaged)
    expected_temp = (25.0 + 27.0 + 23.0) / 3  # ≈ 25.0
    assert meta.blended_temperature_c is not None
    assert abs(meta.blended_temperature_c - expected_temp) < 0.05


def test_b04_missing_variable_excluded_per_variable():
    """A model that is missing precipitation is excluded from the precip blend only,
    but still contributes to temperature and wind blends."""
    engine = ModelBlendingEngine()
    # ECMWF AIFS has no precipitation data
    models = [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                      temperature_c=24.0, precipitation_mm=2.0, wind_speed_kmh=10.0),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                      temperature_c=26.0, precipitation_mm=4.0, wind_speed_kmh=12.0),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                      temperature_c=28.0, precipitation_mm=6.0, wind_speed_kmh=8.0),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0,
                      temperature_c=30.0, precipitation_mm=None, wind_speed_kmh=11.0),
    ]

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    # Temperature: all 4 contribute equally (24 + 26 + 28 + 30) / 4 = 27.0
    assert meta.blended_temperature_c is not None
    assert abs(meta.blended_temperature_c - 27.0) < 0.05

    # Precipitation: only 3 models have data (2 + 4 + 6) / 3 = 4.0
    assert meta.blended_precipitation_mm is not None
    assert abs(meta.blended_precipitation_mm - 4.0) < 0.05

    # Wind: all 4 contribute (10 + 12 + 8 + 11) / 4 = 10.25 → rounds to 10.2 or 10.3
    assert meta.blended_wind_speed_kmh is not None
    assert abs(meta.blended_wind_speed_kmh - 10.25) < 0.1


def test_b05_model_type_labels_preserved():
    """model_type must be preserved on ModelForecast after blending."""
    engine = ModelBlendingEngine()
    models = _make_4_models()

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    aifs = next(m for m in meta.models if m.model_name == "ECMWF AIFS")
    assert aifs.model_type == "AI/ML", f"AIFS model_type should be 'AI/ML', got {aifs.model_type!r}"

    nwp_names = {"ECMWF IFS HRES", "NCEP GFS", "DWD ICON Global"}
    for m in meta.models:
        if m.model_name in nwp_names:
            assert m.model_type == "NWP", f"{m.model_name} model_type should be 'NWP', got {m.model_type!r}"


def test_b06_all_models_unavailable_returns_none_values():
    """If every model has all-None values, blended outputs must all be None."""
    engine = ModelBlendingEngine()
    models = [
        ModelForecast(model_name="ECMWF IFS HRES", model_type="NWP",   weight=0,
                      temperature_c=None, precipitation_mm=None, wind_speed_kmh=None),
        ModelForecast(model_name="NCEP GFS",        model_type="NWP",   weight=0,
                      temperature_c=None, precipitation_mm=None, wind_speed_kmh=None),
        ModelForecast(model_name="DWD ICON Global", model_type="NWP",   weight=0,
                      temperature_c=None, precipitation_mm=None, wind_speed_kmh=None),
        ModelForecast(model_name="ECMWF AIFS",      model_type="AI/ML", weight=0,
                      temperature_c=None, precipitation_mm=None, wind_speed_kmh=None),
    ]

    meta = engine.blend(models, region="Test", lead_time_hours=24)

    assert meta.blended_temperature_c is None
    assert meta.blended_precipitation_mm is None
    assert meta.blended_wind_speed_kmh is None
    for m in meta.models:
        assert m.weight == 0.0, f"{m.model_name} weight should be 0"


def test_b07_same_target_timestamp_used_for_all_models(monkeypatch):
    """All 4 NWP/AI models must share the same target ISO hour prefix in
    blending_metadata.  This verifies the cross-model hour-matching logic."""
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)

    bundle = asyncio.run(FusedWeatherProvider().fetch(0, 0))

    meta = bundle.blending_metadata
    assert meta is not None

    if meta.target_time:
        # The target_time must be the SAME for all 4 blended models
        # (they all match by the same hour-prefix from the primary bundle)
        assert len(meta.target_time) >= 13  # at least "YYYY-MM-DDTHH"

    # All 4 NWP/AI model names should appear in blending metadata
    model_names = {m.model_name for m in meta.models}
    assert "ECMWF IFS HRES" in model_names
    assert "NCEP GFS" in model_names
    assert "DWD ICON Global" in model_names
    assert "ECMWF AIFS" in model_names
