"""
climate.py — ADDITIVE service for the frontend's Climate Analytics page (integration build).

WHAT THIS IS, AND — MORE IMPORTANTLY — WHAT IT IS NOT
  * It pulls Open-Meteo's HISTORICAL ARCHIVE (ERA5-style reanalysis) and computes multi-year
    rainfall / temperature aggregates. That is research/reproducibility data, exactly like the
    forecast provider. It is NOT official IMD climate data and the API labels it as such.
  * Nothing here is fabricated: every number is the provider's own daily value aggregated with
    plain arithmetic. If the upstream cannot be consulted, the endpoint reports that honestly
    (UpstreamError) instead of returning a trend line.
  * The 115 mm/day "heavy rain spell" threshold is the SAME documented engineering heuristic
    advisory.py uses (a disruptive rain day for travel in India), re-used here purely as a
    transparent counter — it is not an IMD criterion and is labelled as such in the response.

The advisory, validation and grounding pipeline never reads this module: it is a separate,
read-only analytics surface for the UI.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List, Optional

from backend import config
from backend.services.http_client import UpstreamError, get_json

# A rain day at/above the advisory heuristic (advisory.THRESHOLDS["rain_day_mm_strong"]) is
# counted as a "heavy spell" day. Kept in sync with that heuristic's value; the response says so.
HEAVY_RAIN_DAY_MM = 115.0

_YEARS = 7  # annual trend window shown by the dashboard


async def fetch_climate(
    latitude: float,
    longitude: float,
    *,
    place_name: str = "",
    years: int = _YEARS,
) -> Dict[str, Any]:
    """Aggregate the last `years` completed years of daily archive data for a location.

    Returns a dict (not an Evidence object): this endpoint is analytics-only and is kept out of
    the LLM/grounding contract. `authority` is always research_repro.
    """
    this_year = dt.date.today().year
    end_year = this_year - 1  # only completed years
    start_year = end_year - years + 1

    params: Dict[str, Any] = {
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "start_date": f"{start_year}-01-01",
        "end_date": f"{end_year}-12-31",
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "auto",
        "wind_speed_unit": "kmh",
    }
    url = config.OPEN_METEO_ARCHIVE_URL
    data = await get_json(url, params=params, service="open-meteo-archive")

    daily = data.get("daily") or {}
    times: List[str] = list(daily.get("time") or [])
    temps: List[Optional[float]] = [_f(v) for v in (daily.get("temperature_2m_mean") or [])]
    precs: List[Optional[float]] = [_f(v) for v in (daily.get("precipitation_sum") or [])]

    # Bucket daily rows by year and by (year, month).
    per_year: Dict[int, Dict[str, Any]] = {}
    per_month_last_year: Dict[int, Dict[str, Any]] = {}
    for i, date_str in enumerate(times):
        try:
            d = dt.date.fromisoformat(str(date_str)[:10])
        except ValueError:
            continue
        y = d.year
        yb = per_year.setdefault(y, {"precip": [], "temp": [], "heavy": 0})
        t = temps[i] if i < len(temps) else None
        p = precs[i] if i < len(precs) else None
        if t is not None:
            yb["temp"].append(t)
        if p is not None:
            yb["precip"].append(p)
            if p >= HEAVY_RAIN_DAY_MM:
                yb["heavy"] += 1
        if y == end_year:
            mb = per_month_last_year.setdefault(d.month, {"precip": [], "temp": []})
            if t is not None:
                mb["temp"].append(t)
            if p is not None:
                mb["precip"].append(p)

    annual: List[Dict[str, Any]] = []
    for y in sorted(per_year):
        b = per_year[y]
        if not b["precip"] and not b["temp"]:
            continue
        annual.append(
            {
                "year": y,
                "rainfall_mm": round(sum(b["precip"]), 1),
                "temp_avg_c": round(sum(b["temp"]) / len(b["temp"]), 2) if b["temp"] else None,
                "heavy_rain_days": b["heavy"],
            }
        )

    if not annual:
        raise UpstreamError("open-meteo-archive", "archive returned no aggregatable daily rows")

    # Normals/anomalies are the SAME window's own multi-year mean — transparent, no hidden base.
    mean_rain = round(sum(a["rainfall_mm"] for a in annual) / len(annual), 1)
    temps_present = [a["temp_avg_c"] for a in annual if a["temp_avg_c"] is not None]
    mean_temp = round(sum(temps_present) / len(temps_present), 2) if temps_present else None
    for a in annual:
        a["rainfall_normal_mm"] = mean_rain
        a["temp_anomaly_c"] = (
            round(a["temp_avg_c"] - mean_temp, 2)
            if (a["temp_avg_c"] is not None and mean_temp is not None)
            else None
        )

    monthly: List[Dict[str, Any]] = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for m in sorted(per_month_last_year):
        b = per_month_last_year[m]
        if not b["precip"] and not b["temp"]:
            continue
        monthly.append(
            {
                "year": end_year,
                "month": month_names[m - 1],
                "rainfall_mm": round(sum(b["precip"]), 1),
                "temp_avg_c": round(sum(b["temp"]) / len(b["temp"]), 2) if b["temp"] else None,
            }
        )

    return {
        "ok": True,
        "authority": "research_repro",
        "source": "Open-Meteo Historical Archive (ERA5 reanalysis)",
        "provider": "open-meteo",
        "kind": "historical_reanalysis",
        "location": place_name or f"{round(latitude, 3)},{round(longitude, 3)}",
        "latitude": latitude,
        "longitude": longitude,
        "period": f"{start_year}–{end_year}",
        "normals_basis": f"mean of the {len(annual)} archived years above (not an official IMD normal)",
        "heavy_rain_threshold_mm": HEAVY_RAIN_DAY_MM,
        "heavy_rain_note": (
            f"days with daily precipitation >= {HEAVY_RAIN_DAY_MM} mm, the same documented "
            "engineering heuristic the advisory engine uses; not an IMD criterion"
        ),
        "disclaimer": (
            "Trends are aggregated from Open-Meteo's ERA5-style reanalysis archive for "
            "research/reproducibility. They are NOT official India Meteorological Department "
            "(IMD) climate normals or observations."
        ),
        "annual": annual,
        "monthly": monthly,
        "request_url": f"{url}?{_qs(params)}",
        "retrieved_at_utc": dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
    }


def _qs(params: Dict[str, Any]) -> str:
    from urllib.parse import urlencode

    return urlencode(params)


def _f(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None
