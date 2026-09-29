import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from backend.services.providers.openweathermap import OpenWeatherMapProvider

async def run():
    print("Checking OpenWeatherMap API Key presence...")
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY")
    print(f"Key present: {bool(owm_key)}")
    
    if not owm_key:
        print("No API key to test.")
        return
        
    print("\n--- Testing OpenWeatherMap Real Request ---")
    tom_provider = OpenWeatherMapProvider()
    
    # Mumbai coords
    lat, lon = 19.0760, 72.8777
    print(f"Target Lat: {lat}, Lon: {lon}")
    
    try:
        bundle = await tom_provider.fetch(lat, lon)
        print("OpenWeatherMap Request SUCCEEDED.")
    except Exception as e:
        # e should be UpstreamError which includes the service and detail
        # UpstreamError string format: "service: detail"
        err_str = str(e)
        sanitized_err = err_str.replace(owm_key, "REDACTED_KEY") if owm_key else err_str
        print(f"OpenWeatherMap Request FAILED.")
        print(f"Error Detail: {sanitized_err}")

if __name__ == "__main__":
    asyncio.run(run())
