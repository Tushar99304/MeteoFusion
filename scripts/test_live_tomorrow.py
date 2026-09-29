import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from backend.services.providers.tomorrowio import TomorrowIoProvider
from backend.services.providers.fused import FusedWeatherProvider
from backend.models import WeatherBundle

async def run():
    print("Checking API Keys...")
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY")
    tom_key = os.getenv("TOMORROW_IO_API_KEY")
    
    print(f"Open-Meteo: available")
    print(f"OpenWeatherMap: {'available' if owm_key else 'unavailable'}")
    print(f"Tomorrow.io: {'available' if tom_key else 'unavailable'}")
    
    if tom_key:
        print("\n--- Testing Tomorrow.io Real Request ---")
        try:
            tom_provider = TomorrowIoProvider()
            # Mumbai coords: 19.0760, 72.8777
            bundle = await tom_provider.fetch(19.0760, 72.8777)
            c = bundle.current
            print("Tomorrow.io Request SUCCEEDED.")
            print(f"  Temperature: {c.temperature_c}°C")
            print(f"  Apparent Temp: {c.apparent_temperature_c}°C")
            print(f"  Humidity: {c.humidity_pct}%")
            print(f"  Wind Speed: {c.wind_speed_kmh} km/h")
            print(f"  Precipitation: {c.precipitation_mm} mm")
            print(f"  Time: {c.time}")
            print(f"  Units: {c.units}")
        except Exception as e:
            print(f"Tomorrow.io Request FAILED: {e}")
            
    print("\n--- Testing Fused Provider ---")
    fused_provider = FusedWeatherProvider()
    try:
        fused_bundle = await fused_provider.fetch(19.0760, 72.8777)
        c = fused_bundle.current
        print("Fused Request SUCCEEDED.")
        print(f"Number of sources used in fusion: {len(fused_bundle.fused_sources)}")
        print(f"Sources: {fused_bundle.fused_sources}")
        print("Final Fused Weather Values:")
        print(f"  Temperature: {c.temperature_c:.1f}°C")
        if c.apparent_temperature_c is not None:
            print(f"  Apparent Temp: {c.apparent_temperature_c:.1f}°C")
        if c.humidity_pct is not None:
            print(f"  Humidity: {c.humidity_pct:.1f}%")
        if c.wind_speed_kmh is not None:
            print(f"  Wind Speed: {c.wind_speed_kmh:.1f} km/h")
        if c.precipitation_mm is not None:
            print(f"  Precipitation: {c.precipitation_mm:.1f} mm")
        print(f"Source Agreement Status: {fused_bundle.source_agreement} (Score: {fused_bundle.source_agreement_score})")
    except Exception as e:
        print(f"Fused Request FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(run())
