import asyncio
import os
import datetime as dt

from dotenv import load_dotenv
load_dotenv()

from backend.main import run_pipeline

async def test_mumbai():
    print("--- LIVE TEST: MUMBAI E2E FUSION ---")
    
    # Provider status
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY")
    tom_key = os.getenv("TOMORROW_IO_API_KEY")
    print(f"Open-Meteo: available")
    print(f"OpenWeatherMap: {'available' if owm_key else 'unavailable'}")
    print(f"Tomorrow.io: {'available' if tom_key else 'unavailable'}")
    
    ev, trace = await run_pipeline(
        message="What is the weather in Mumbai?",
        coordinates=(19.0760, 72.8777),
        conversational=False
    )
    
    if ev.status != "grounded":
        print(f"Pipeline did not return grounded evidence. Status: {ev.status}")
        print(ev.abstain_reason)
        return
        
    print("\n--- RESULTS ---")
    w = ev.weather
    c = w.current
    print(f"Providers contributing: {w.fused_sources}")
    rejected = [p for p in ["open-meteo", "openweathermap", "tomorrowio"] if p not in w.fused_sources]
    print(f"Providers rejected/failed: {rejected}")
    
    print("\nFused Weather:")
    print(f"  Temperature: {c.temperature_c}°C")
    print(f"  Humidity: {c.humidity_pct}%")
    print(f"  Wind: {c.wind_speed_kmh} km/h")
    print(f"  Precipitation: {c.precipitation_mm} mm")
    
    print(f"\nSource Agreement: {w.source_agreement} (Score: {w.source_agreement_score})")
    
    print("\nFinal Risk/Advisory Output:")
    print(f"  Risk Level: {ev.advisory.risk_level}")
    print(f"  Headline: {ev.advisory.headline}")
    print(f"  Reasons Fired: {ev.advisory.rules_fired}")

if __name__ == "__main__":
    asyncio.run(test_mumbai())
