import pytest
import os
from backend import config

@pytest.fixture(autouse=True)
def ensure_open_meteo_default(monkeypatch):
    """
    All existing tests assume WEATHER_PROVIDER is 'open-meteo'.
    Because the production default is being changed to 'multi-source',
    this fixture forces the test environment back to 'open-meteo' by default,
    so the 280+ existing unit tests (which mock and assert Open-Meteo fields) continue to pass.
    """
    monkeypatch.setattr(config, "WEATHER_PROVIDER", "open-meteo")
    monkeypatch.setattr("backend.services.weather._PROVIDER", None)
