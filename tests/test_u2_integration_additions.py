"""
test_u2_integration_additions.py — U2: React-frontend integration, additive backend surface.

Fully offline, NO network. Pins down the three additive backend pieces added for the React
frontend WITHOUT changing any Phase 1–U1 safety invariant:

  1. advisory `activity` parameter (advisory sector tabs):
       * risk_level, rule ids, alert precedence and alert_ids are IDENTICAL for the same
         Evidence regardless of the activity — the sector may only add framing;
       * an unknown/blank activity changes nothing and adds no factor;
       * the active severe official alert (R1) still decides HIGH before any sector framing;
       * the fixed "Weather-related travel risk is ..." headline wording is unchanged.
  2. hourly normalisation (weather._zip_hourly):
       * slices at most `limit` steps starting at the provider's current hour (location clock);
       * never fills gaps — absent provider values stay None;
       * conditions come from the same WMO lookup as the daily block.
  3. climate aggregation (services/climate) is tested on a synthetic daily archive via a stubbed
     get_json, asserting authority stays research_repro and the response never claims IMD.

Run:  python -m pytest tests/test_u2_integration_additions.py -v
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List

import pytest

from backend.models import (
    Alert,
    AlertRelevance,
    AlertsEvidence,
    CurrentWeather,
    Evidence,
    ForecastDay,
    ResolvedLocation,
    Source,
    WeatherBundle,
)
from backend.services import advisory as ADV
from backend.services import climate as CLIMATE
from backend.services import weather as W


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _loc() -> ResolvedLocation:
    return ResolvedLocation(name="Pune", latitude=18.52, longitude=73.86, admin1="Maharashtra")


def _quiet_evidence() -> Evidence:
    """Sufficient, calm weather, alerts checked with nothing relevant -> R7 LOW."""
    # Local wall time (IST, +5:30) a couple of minutes ago, so freshness validation passes.
    local_now = dt.datetime.utcnow() + dt.timedelta(seconds=19800)
    today = local_now.date().isoformat()
    bundle = WeatherBundle(
        provider="open-meteo",
        kind="live",
        retrieved_at_utc=dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        api_utc_offset_seconds=19800,
        current=CurrentWeather(
            time=local_now.replace(second=0, microsecond=0).isoformat(timespec="minutes"),
            utc_offset_seconds=19800,
            temperature_c=26.0,
            apparent_temperature_c=27.0,
            humidity_pct=70.0,
            precipitation_mm=0.0,
            wind_speed_kmh=8.0,
            pressure_hpa=1010.0,
            cloud_cover_pct=20.0,
            weather_code=1,
            condition="Mainly clear",
        ),
        today=ForecastDay(date=today, label="Today", precipitation_sum_mm=0.0,
                          wind_speed_max_kmh=10.0, weather_code=1, condition="Mainly clear"),
    )
    ev = Evidence(
        status="grounded",
        request={"message": "weather in pune", "intent": "forecast_current", "timeframe": "now"},
        location=_loc(),
        weather=bundle,
        alerts=AlertsEvidence(state="checked", mode="live", items=[]),
        sources=[
            Source(name="Open-Meteo", type="forecast", timestamp=bundle.retrieved_at_utc,
                   url="https://api.open-meteo.com/v1/forecast", authority="research_repro"),
            Source(name="NDMA SACHET", type="official_alert", authority="official"),
        ],
    )
    from backend.services import validation as V
    ev.validation = V.validate_evidence(ev)
    from backend.services import quality as Q
    label, _ = Q.score_evidence(ev, ev.validation)
    ev.evidence_quality = label
    return ev


def _severe_alert_evidence() -> Evidence:
    """An active, location-verified Severe official alert -> R1 HIGH."""
    ev = _quiet_evidence()
    alert = Alert(
        alert_id="IN-50",
        sender="IMD Pune",
        event="Heavy Rain",
        headline="Heavy rain alert for Pune district",
        instruction="Follow SDMA guidelines and avoid low-lying areas.",
        severity="Severe",
        urgency="Immediate",
        validity="active",
        area_desc="Pune district of Maharashtra",
        relevance=AlertRelevance(status="relevant", level="L1_exact_locality",
                                 reason="areaDesc names this place"),
    )
    ev.alerts.items = [alert]
    ev.validation.alerts_valid = True
    return ev


# --------------------------------------------------------------------------- #
# 1. advisory activity parameter
# --------------------------------------------------------------------------- #
def test_activity_unknown_or_blank_changes_nothing():
    ev = _quiet_evidence()
    base = ADV.advise(ev)
    for bad in (None, "", "   ", "quantum fishing on mars"):
        a = ADV.advise(ev, activity=bad)
        assert a.risk_level == base.risk_level
        assert a.activity == base.activity
        assert a.rules_fired == base.rules_fired
        assert a.factors == base.factors, "unknown activity must add no framing factor"
        assert a.alert_ids == base.alert_ids


def test_activity_known_changes_label_and_adds_one_factor_but_not_risk():
    ev = _quiet_evidence()
    base = ADV.advise(ev)
    marine = ADV.advise(ev, activity="marine")
    # risk decision is byte-for-byte the same decision:
    assert marine.risk_level == base.risk_level == "LOW"
    assert marine.rules_fired == base.rules_fired == ["R7_quiet"]
    assert marine.alert_ids == base.alert_ids == []
    # ...only the label and one framing factor differ:
    assert marine.activity == "marine & fishing"
    extra = [f for f in marine.factors if f not in base.factors]
    assert len(extra) == 1
    assert extra[0].startswith("activity context (marine & fishing):")


def test_activity_aliases_normalize_to_known_sector():
    assert ADV.normalize_activity("Marine & Fishing") == "marine"
    assert ADV.normalize_activity("driving") == "driving"
    assert ADV.normalize_activity("Agro Advisory") == "agriculture"
    assert ADV.normalize_activity("trekking") == "trekking"
    assert ADV.normalize_activity("nope") is None


def test_activity_never_overrides_severe_alert_precedence():
    ev = _severe_alert_evidence()
    for act in (None, "driving", "marine", "agriculture", "daily activity"):
        a = ADV.advise(ev, activity=act)
        assert a.risk_level == "HIGH", f"R1 must stay HIGH for activity={act!r}"
        assert "R1_active_severe_official_alert" in a.rules_fired
        assert a.alert_ids == ["IN-50"]
        # the official instruction must still be quoted, before any sector framing:
        joined = " | ".join(a.factors)
        assert "Follow SDMA guidelines" in joined
        assert "IN-50" in a.alert_ids
        # fixed product wording never becomes "it is safe to fish":
        assert a.headline.startswith("Weather-related travel risk is HIGH based on")


def test_activity_factor_does_not_invent_numbers():
    ev = _quiet_evidence()
    a = ADV.advise(ev, activity="trekking")
    for f in a.factors:
        if f.startswith("activity context"):
            # framing text only — no fabricated measurements:
            for token in (" mm", " km/h", "%"):
                assert token not in f


# --------------------------------------------------------------------------- #
# 2. hourly normalisation
# --------------------------------------------------------------------------- #
def _hourly_payload(start: str, n: int) -> Dict[str, Any]:
    base = dt.datetime.fromisoformat(start)
    times = [(base + dt.timedelta(hours=i)).isoformat(timespec="minutes") for i in range(n)]
    return {
        "utc_offset_seconds": 19800,
        "current": {"time": times[2]},  # provider's "now" is the 3rd step
        "hourly": {
            "time": times,
            "temperature_2m": [25.0 + i for i in range(n)],
            "precipitation": [0.0, 0.2, None] + [1.0] * (n - 3),
            "precipitation_probability": [10, 20, None] + [40] * (n - 3),
            "relative_humidity_2m": [80] * n,
            "wind_speed_10m": [9.0] * n,
            "weather_code": [0, 61, 95] + [2] * (n - 3),
        },
        "hourly_units": {"temperature_2m": "°C", "precipitation": "mm"},
    }


def test_zip_hourly_slices_from_current_hour_and_caps_count():
    data = _hourly_payload("2026-09-01T06:00", 40)
    points = W._zip_hourly(
        data["hourly"], data["utc_offset_seconds"], data["hourly_units"],
        current_time=data["current"]["time"], limit=24,
    )
    assert len(points) == 24
    # starts at the current hour (index 2 -> 08:00), not at the start of the feed:
    assert points[0].time == "2026-09-01T08:00"
    assert points[0].temperature_c == 27.0
    assert points[-1].time == "2026-09-02T07:00"


def test_zip_hourly_never_fills_gaps_and_uses_wmo_lookup():
    data = _hourly_payload("2026-09-01T06:00", 5)
    points = W._zip_hourly(
        data["hourly"], data["utc_offset_seconds"], data["hourly_units"],
        current_time=data["current"]["time"], limit=24,
    )
    # the None at the current hour (index 2) is preserved, not invented:
    cur = points[0]
    assert cur.precipitation_mm is None
    assert cur.precipitation_probability_pct is None
    assert cur.condition == "Thunderstorm"  # WMO 95, same lookup as daily block
    assert points[1].condition == "Partly cloudy"  # WMO 2


def test_zip_hourly_empty_when_no_hourly_block():
    assert W._zip_hourly({}, 19800, {}, current_time=None) == []


# --------------------------------------------------------------------------- #
# 3. climate aggregation (research/repro, never IMD)
# --------------------------------------------------------------------------- #
def _archive_payload() -> Dict[str, Any]:
    """Two full years of synthetic daily rows (dry 2024, wet 2025)."""
    times: List[str] = []
    temps: List[float] = []
    precs: List[float] = []
    for year, rain, temp in ((2024, 0.0, 26.0), (2025, 200.0, 28.0)):
        d = dt.date(year, 1, 1)
        while d.year == year:
            times.append(d.isoformat())
            temps.append(temp)
            # spread the annual total across ~10 heavy days in that year
            precs.append(rain / 10 if d.month == 7 and d.day <= 10 else 0.0)
            d += dt.timedelta(days=1)
    return {
        "daily": {"time": times, "temperature_2m_mean": temps, "precipitation_sum": precs}
    }


def test_climate_aggregate_is_research_repro_and_never_imd(monkeypatch):
    import asyncio

    async def fake_get_json(url, params=None, service=None):
        assert "archive" in url
        return _archive_payload()

    monkeypatch.setattr(CLIMATE, "get_json", fake_get_json)
    res = asyncio.run(CLIMATE.fetch_climate(18.52, 73.86, place_name="Pune", years=2))

    assert res["ok"] is True
    assert res["authority"] == "research_repro"
    assert "archive" in res["source"].lower()
    assert "IMD" in res["disclaimer"] and "NOT official" in res["disclaimer"]
    assert res["period"] == "2024–2025"

    annual = {row["year"]: row for row in res["annual"]}
    assert set(annual) == {2024, 2025}
    assert annual[2024]["rainfall_mm"] == 0.0
    assert annual[2025]["rainfall_mm"] == pytest.approx(200.0, abs=0.1)
    # 2025 has 10 days at 20 mm each (< 115 mm threshold) -> 0 heavy days, transparently:
    assert annual[2025]["heavy_rain_days"] == 0
    assert annual[2024]["temp_anomaly_c"] is not None
    # normals are the window's own mean — no hidden official normal:
    assert "not an official IMD normal" in res["normals_basis"]
    assert res["monthly"], "monthly block for the last year is present"
