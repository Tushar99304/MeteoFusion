import pytest
import asyncio
import datetime as dt
from backend import config
from backend.services.providers.fused import FusedWeatherProvider
from backend.models import WeatherBundle, CurrentWeather
from backend.services.http_client import UpstreamError
from backend.services.weather import OpenMeteoProvider
from backend.services.providers.openweathermap import OpenWeatherMapProvider
from backend.services.providers.tomorrowio import TomorrowIoProvider

def _mock_open_meteo(monkeypatch):
    async def mock_fetch(*args, **kwargs):
        return WeatherBundle(
            provider="open-meteo",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00:00Z",
                temperature_c=25.0,
                apparent_temperature_c=26.0,
                humidity_pct=60.0,
                precipitation_mm=0.0,
                wind_speed_kmh=10.0,
                pressure_hpa=1012.0
            )
        )
    monkeypatch.setattr(OpenMeteoProvider, "fetch", mock_fetch)

def _mock_openweathermap(monkeypatch, temp=25.5, fail=False):
    async def mock_fetch(*args, **kwargs):
        if fail: raise UpstreamError("owm", "fail")
        return WeatherBundle(
            provider="openweathermap",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00:00Z",
                temperature_c=temp,
                apparent_temperature_c=26.5,
                humidity_pct=62.0,
                precipitation_mm=0.0,
                wind_speed_kmh=12.0,
                pressure_hpa=1010.0
            )
        )
    monkeypatch.setattr(OpenWeatherMapProvider, "fetch", mock_fetch)

def _mock_tomorrowio(monkeypatch, temp=24.8, fail=False):
    async def mock_fetch(*args, **kwargs):
        if fail: raise UpstreamError("tomorrowio", "fail")
        return WeatherBundle(
            provider="tomorrowio",
            kind="live",
            requested_timeframe="now",
            current=CurrentWeather(
                time="2026-09-01T12:00:00Z",
                temperature_c=temp,
                apparent_temperature_c=25.8,
                humidity_pct=58.0,
                precipitation_mm=0.0,
                wind_speed_kmh=8.0,
                pressure_hpa=1014.0
            )
        )
    monkeypatch.setattr(TomorrowIoProvider, "fetch", mock_fetch)

def test_01_all_three_sources_available(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert bundle.provider == "multi-source"
    assert len(bundle.fused_sources) == 3
    assert not bundle.disagreement_flag
    assert bundle.source_agreement_score == 1.0
    # Average of 25.0, 25.5, 24.8 = 25.1
    assert abs(bundle.current.temperature_c - 25.1) < 0.1

def test_02_one_source_unavailable(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch)
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert len(bundle.fused_sources) == 2
    assert bundle.source_agreement_score == 1.0
    # Average of 25.0 and 24.8 = 24.9
    assert abs(bundle.current.temperature_c - 24.9) < 0.1

def test_03_two_sources_unavailable_single_source_fallback(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch, fail=True)
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert len(bundle.fused_sources) == 1
    assert bundle.fused_sources[0] == "open-meteo"
    assert bundle.source_agreement_score is None
    assert bundle.source_agreement == "Single-source / limited evidence"
    assert bundle.current.temperature_c == 25.0

def test_04_strong_disagreement_between_sources(monkeypatch):
    _mock_open_meteo(monkeypatch) # 25.0
    _mock_openweathermap(monkeypatch, temp=25.2) # close
    _mock_tomorrowio(monkeypatch, temp=35.0) # strong disagreement
    
    monkeypatch.setattr(config, "FUSION_MAX_DISAGREEMENT_C", 5.0)
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert bundle.disagreement_flag is True
    # The outlier (35.0) should be dropped by our 3-source outlier logic, so fusion is 25.1
    assert bundle.source_agreement_score == 0.7
    assert abs(bundle.current.temperature_c - 25.1) < 0.1

def test_05_all_sources_disagree(monkeypatch):
    _mock_open_meteo(monkeypatch) # 25.0
    _mock_openweathermap(monkeypatch, temp=35.0) 
    _mock_tomorrowio(monkeypatch, temp=15.0)
    
    monkeypatch.setattr(config, "FUSION_MAX_DISAGREEMENT_C", 5.0)
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert bundle.disagreement_flag is True
    assert bundle.source_agreement_score == 0.3
    assert abs(bundle.current.temperature_c - 25.0) < 0.1

def test_06_weighted_fusion_calculation(monkeypatch):
    _mock_open_meteo(monkeypatch) # 25.0, weight=1
    _mock_openweathermap(monkeypatch, temp=26.0) # 26.0, weight=2
    _mock_tomorrowio(monkeypatch, temp=27.0) # 27.0, weight=0
    
    monkeypatch.setattr(config, "FUSION_WEIGHT_OPEN_METEO", 1.0)
    monkeypatch.setattr(config, "FUSION_WEIGHT_OPENWEATHER", 2.0)
    monkeypatch.setattr(config, "FUSION_WEIGHT_TOMORROWIO", 0.0) # Should be skipped
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    # 25*1 + 26*2 / 3 = 77 / 3 = 25.666
    assert "tomorrowio" not in bundle.fused_sources
    assert len(bundle.fused_sources) == 2
    assert abs(bundle.current.temperature_c - 25.666) < 0.01

def test_07_no_api_keys_configured(monkeypatch):
    # If API keys are empty, the original providers raise UpstreamError
    # which our FusedWeatherProvider should catch and gracefully handle
    monkeypatch.setattr(config, "OPENWEATHERMAP_API_KEY", "")
    monkeypatch.setattr(config, "TOMORROW_IO_API_KEY", "")
    
    # open-meteo does not need an API key
    
    provider = FusedWeatherProvider()
    bundle = asyncio.run(provider.fetch(0, 0))
    
    assert len(bundle.fused_sources) == 1
    assert bundle.fused_sources[0] == "open-meteo"
