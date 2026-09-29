import pytest
import asyncio
import datetime as dt

from backend import config
from backend.main import run_pipeline
from backend.models import WeatherBundle, CurrentWeather, ForecastDay
from backend.services.http_client import UpstreamError
from backend.services.weather import OpenMeteoProvider
from backend.services.providers.openweathermap import OpenWeatherMapProvider
from backend.services.providers.tomorrowio import TomorrowIoProvider

NOW = dt.datetime.now(dt.timezone.utc)
NOW_ISO = NOW.replace(microsecond=0).isoformat().replace("+00:00", "Z")
TODAY_STR = NOW.strftime("%Y-%m-%d")

def _ask(message: str):
    import backend.config
    print("WEATHER_PROVIDER inside _ask:", backend.config.WEATHER_PROVIDER)
    print("REGISTRY active model:", __import__("backend.services.providers.registry").services.providers.registry.active_model())
    return asyncio.run(run_pipeline(message, conversational=False))
import pytest
@pytest.fixture(autouse=True)
def setup_multi_source(monkeypatch):
    monkeypatch.setattr(config, "WEATHER_PROVIDER", "multi-source")
    monkeypatch.setattr(config, "LLM_ENABLED", False)  # Use deterministic fallback for speed
    monkeypatch.setattr("backend.services.weather._PROVIDER", None)

def _mock_open_meteo(monkeypatch, fail=False, temp=25.0, precip=0.0):
    async def mock_fetch(*args, **kwargs):
        if fail: raise UpstreamError("open-meteo", "fail")
        return WeatherBundle(
            provider="open-meteo", kind="live", requested_timeframe="now",
            retrieved_at_utc=NOW_ISO, request_url="",
            current=CurrentWeather(
                time=NOW_ISO,
                temperature_c=temp, apparent_temperature_c=26.0,
                humidity_pct=60.0, precipitation_mm=precip,
                wind_speed_kmh=10.0, pressure_hpa=1012.0
            ),
            today=ForecastDay(date=TODAY_STR, temperature_max_c=30.0, temperature_min_c=22.0, precipitation_sum_mm=precip, precipitation_probability_max_pct=10.0)
        )
    monkeypatch.setattr(OpenMeteoProvider, "fetch", mock_fetch)

def _mock_openweathermap(monkeypatch, fail=False, temp=25.5, precip=0.0):
    async def mock_fetch(*args, **kwargs):
        if fail: raise UpstreamError("openweathermap", "fail")
        return WeatherBundle(
            provider="openweathermap", kind="live", requested_timeframe="now",
            retrieved_at_utc=NOW_ISO, request_url="",
            current=CurrentWeather(
                time=NOW_ISO,
                temperature_c=temp, apparent_temperature_c=26.5,
                humidity_pct=62.0, precipitation_mm=precip,
                wind_speed_kmh=12.0, pressure_hpa=1010.0
            ),
            today=ForecastDay(date=TODAY_STR, temperature_max_c=30.0, temperature_min_c=22.0, precipitation_sum_mm=precip, precipitation_probability_max_pct=10.0)
        )
    monkeypatch.setattr(OpenWeatherMapProvider, "fetch", mock_fetch)

def _mock_tomorrowio(monkeypatch, fail=False, temp=24.8, precip=0.0):
    async def mock_fetch(*args, **kwargs):
        if fail: raise UpstreamError("tomorrowio", "fail")
        return WeatherBundle(
            provider="tomorrowio", kind="live", requested_timeframe="now",
            retrieved_at_utc=NOW_ISO, request_url="",
            current=CurrentWeather(
                time=NOW_ISO,
                temperature_c=temp, apparent_temperature_c=25.8,
                humidity_pct=58.0, precipitation_mm=precip,
                wind_speed_kmh=8.0, pressure_hpa=1014.0
            ),
            today=ForecastDay(date=TODAY_STR, temperature_max_c=30.0, temperature_min_c=22.0, precipitation_sum_mm=precip, precipitation_probability_max_pct=10.0)
        )
    monkeypatch.setattr(TomorrowIoProvider, "fetch", mock_fetch)


# A. All 3 providers available
def test_all_providers_available(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert "open-meteo" in ev.weather.fused_sources
    assert "openweathermap" in ev.weather.fused_sources
    assert "tomorrowio" in ev.weather.fused_sources
    assert len(ev.weather.fused_sources) == 3
    assert ev.evidence_quality in ["HIGH", "MEDIUM"]
    
    # Verify stages contain validate, quality, advise, llm, grounding
    stages = [s["stage"] for s in trace["stages"]]
    assert "validate" in stages
    assert "quality" in stages
    assert "advise" in stages
    assert "llm" in stages
    assert "grounding" in stages

# B. OpenWeatherMap unavailable
def test_owm_unavailable(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert "openweathermap" not in ev.weather.fused_sources
    assert len(ev.weather.fused_sources) == 2

# C. Tomorrow.io unavailable
def test_tomorrowio_unavailable(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch, fail=True)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert len(ev.weather.fused_sources) == 2

# D. Open-Meteo unavailable
def test_open_meteo_unavailable(monkeypatch):
    _mock_open_meteo(monkeypatch, fail=True)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert len(ev.weather.fused_sources) == 2

# E. Only one provider available
def test_one_provider_available(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch, fail=True)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert len(ev.weather.fused_sources) == 1
    assert ev.weather.source_agreement == "Single-source / limited evidence"
    # A single source capped score defaults to MEDIUM or HIGH depending on fallback.
    assert ev.evidence_quality in ["MEDIUM", "HIGH", "LOW"]

# F. Provider disagreement/outlier
def test_provider_disagreement(monkeypatch):
    _mock_open_meteo(monkeypatch, temp=25.0)
    _mock_openweathermap(monkeypatch, temp=25.2)
    _mock_tomorrowio(monkeypatch, temp=35.0)
    monkeypatch.setattr(config, "FUSION_MAX_DISAGREEMENT_C", 5.0)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert ev.weather.disagreement_flag is True
    assert ev.weather.source_agreement_score < 1.0

# G. Missing variables (No precipitation)
def test_missing_variables(monkeypatch):
    _mock_open_meteo(monkeypatch, precip=None)
    _mock_openweathermap(monkeypatch, precip=None)
    _mock_tomorrowio(monkeypatch, precip=None)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert ev.weather.current.precipitation_mm is None

# H. Stale provider data
def test_stale_provider_data(monkeypatch):
    async def mock_stale(*args, **kwargs):
        stale_time = (NOW - dt.timedelta(days=2)).isoformat()
        stale_date = (NOW - dt.timedelta(days=2)).strftime("%Y-%m-%d")
        return WeatherBundle(
            provider="open-meteo", kind="live", requested_timeframe="now",
            retrieved_at_utc=stale_time, request_url="",
            current=CurrentWeather(
                time=stale_time,
                temperature_c=25.0, apparent_temperature_c=26.0,
                humidity_pct=60.0, precipitation_mm=0.0,
                wind_speed_kmh=10.0, pressure_hpa=1012.0
            ),
            today=ForecastDay(date=stale_date, temperature_max_c=30.0, temperature_min_c=22.0, precipitation_sum_mm=0.0, precipitation_probability_max_pct=10.0)
        )
    monkeypatch.setattr(OpenMeteoProvider, "fetch", mock_stale)
    _mock_openweathermap(monkeypatch, fail=True)
    _mock_tomorrowio(monkeypatch, fail=True)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    # Depending on thresholds, it might abstain or flag LOW quality
    assert ev.evidence_quality == "LOW" or ev.status == "abstain"

# I. SACHET alert + multi-source weather
def test_sachet_alert_with_fusion(monkeypatch):
    _mock_open_meteo(monkeypatch)
    _mock_openweathermap(monkeypatch)
    _mock_tomorrowio(monkeypatch)
    
    # Mock SACHET
    from backend.services import alerts
    from backend.models import AlertsEvidence, Alert, AlertRelevance
    async def fake_check_alerts(*args, **kwargs):
        return AlertsEvidence(
            state="checked", source="NDMA SACHET (CAP/RSS)", authority="official", mode="live",
            items=[Alert(
                alert_id="TEST-123", headline="TEST ALERT", description="TEST",
                area_desc="Mumbai", severity="Severe", urgency="Immediate",
                certainty="Observed", onset_at="2026-09-01", expires_at="2026-09-02",
                validity="active",
                relevance=AlertRelevance(status="relevant", level="L1_exact_locality", reason="Match")
            )]
        )
    monkeypatch.setattr(alerts, "check_alerts", fake_check_alerts)
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert ev.alerts.state == "checked"
    assert len(ev.alerts.items) == 1
    assert "TEST-123" in ev.advisory.alert_ids

# J. Complete user request through advisory
def test_advisory_fusion(monkeypatch):
    # Heavy rain to trigger advisory
    _mock_open_meteo(monkeypatch, precip=50.0)
    _mock_openweathermap(monkeypatch, precip=55.0)
    _mock_tomorrowio(monkeypatch, precip=48.0)
    
    ev, trace = _ask("Is it safe to travel to Mumbai?")
    assert ev.status == "grounded"
    assert ev.advisory.risk_level == "HIGH"
    assert "R3_weather_hazard" in ev.advisory.rules_fired or "R3_weather_hazard_strong" in ev.advisory.rules_fired

# K. Complete user request through grounded LLM
def test_grounded_llm_fusion(monkeypatch):
    _mock_open_meteo(monkeypatch, temp=30.0)
    _mock_openweathermap(monkeypatch, temp=30.5)
    _mock_tomorrowio(monkeypatch, temp=29.8)
    
    # Re-enable LLM fallback for this test specifically to ensure grounding verification runs
    monkeypatch.setattr(config, "LLM_ENABLED", True)
    monkeypatch.setattr(config, "GROQ_API_KEY", "")
    
    ev, trace = _ask("What is the weather in Mumbai?")
    assert ev.status == "grounded", ev.abstain_reason
    assert trace.get("answer") is not None
    assert trace["answer"]["origin"] == "deterministic_fallback"
    
    stages = [s["stage"] for s in trace["stages"]]
    assert "grounding" in stages
    assert "llm" in stages
