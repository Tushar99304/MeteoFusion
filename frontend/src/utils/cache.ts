/**
 * LocalStorage / Offline Cache helper for WeatherGPT
 */

const CACHE_PREFIX = 'weathergpt_cache_';

export function setCachedData<T>(key: string, data: T): void {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      data,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export function getCachedData<T>(key: string): { timestamp: string; data: T } | null {
  try {
    const item = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!item) return null;
    return JSON.parse(item);
  } catch {
    return null;
  }
}
