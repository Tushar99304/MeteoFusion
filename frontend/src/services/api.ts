/**
 * api.ts — legacy thin fetch wrapper kept for compatibility.
 *
 * New code should use backendClient.ts (typed /api/query, /health, /api/overview,
 * /api/climate). This wrapper is no longer wired to fabricated endpoints.
 */
import { API_BASE_URL, BackendError } from './backendClient';

export { API_BASE_URL };

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  source: string;
  timestamp: string;
  error?: string;
}

/**
 * Generic JSON helper retained for ad-hoc backend GETs. Throws BackendError on failure
 * (callers decide whether to fall back to clearly-labelled sample data).
 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
      ...options,
    });
  } catch (err) {
    throw new BackendError(err instanceof Error ? err.message : String(err), undefined, 'network');
  }
  if (!res.ok) {
    throw new BackendError(`HTTP ${res.status} for ${endpoint}`, res.status, 'http');
  }
  const data = (await res.json()) as T;
  return { success: true, data, source: 'backend', timestamp: new Date().toISOString() };
}
