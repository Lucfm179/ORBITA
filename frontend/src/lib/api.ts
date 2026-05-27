const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface SpaceObject {
  norad_id: number;
  name: string;
  type: string;
}

export interface TLEObject {
  norad_id: number;
  name: string;
  object_type: string;
  tle_line1: string;
  tle_line2: string;
  epoch: string;
}

export interface FleetAsset {
  norad_id: number;
  name: string;
  object_type: string;
  status: 'operational' | 'degraded' | 'critical';
  active_conjunctions: number;
  apogee_km?: number;
  perigee_km?: number;
}

export interface CatalogStats {
  total: number;
  active: number;
  debris: number;
  last_updated: string | null;
}

export interface Conjunction {
  id: string;
  primary: SpaceObject;
  secondary: SpaceObject;
  tca: string;
  miss_distance_km: number;
  relative_velocity_kms: number;
  probability: number;
  risk_score: number;
  risk_tier: 'baixo' | 'medio' | 'alto';
  tle_age_hours: number;
  recommended_action: string;
  computed_at: string;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchJSON<{ status: string; timestamp: string; catalog_loaded: boolean }>('/health'),
  catalogStats: () => fetchJSON<CatalogStats>('/catalog/stats'),
  tle: () => fetchJSON<TLEObject[]>('/objects/tle'),
  fleet: () => fetchJSON<FleetAsset[]>('/fleet'),
  conjunctions: (params?: { asset?: number; hours?: number; min_tier?: string }) => {
    const query = new URLSearchParams();
    if (params?.asset) query.set('asset', String(params.asset));
    if (params?.hours) query.set('hours', String(params.hours));
    if (params?.min_tier) query.set('min_tier', params.min_tier);
    const qs = query.toString();
    return fetchJSON<Conjunction[]>(`/conjunctions${qs ? '?' + qs : ''}`);
  },
  conjunction: (id: string) => fetchJSON<Conjunction>(`/conjunctions/${id}`),
};
