import type { Location } from '../types';
import { POPULAR_LOCATIONS } from '../constants/locations';

export function searchLocations(query: string): Location[] {
  if (!query.trim()) return POPULAR_LOCATIONS;
  const q = query.toLowerCase().trim();
  return POPULAR_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.state.toLowerCase().includes(q) ||
      (loc.district && loc.district.toLowerCase().includes(q))
  );
}

export function getCurrentGeoLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          id: 'user-gps-loc',
          name: 'Current Position (GPS)',
          state: 'Detected Location',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { timeout: 8000 }
    );
  });
}
