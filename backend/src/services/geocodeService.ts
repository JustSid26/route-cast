import axios from 'axios';
import { env, orsEnabled } from '../config/env';
import { AppError } from '../utils/AppError';

export interface GeoResult {
  label: string;
  latitude: number;
  longitude: number;
}

export interface GeoFocus {
  latitude: number;
  longitude: number;
}

/**
 * Forward-geocode a free-text address into coordinate candidates using the
 * OpenRouteService (Pelias) geocoder. Requires an ORS key — there is no
 * offline fallback for geocoding.
 *
 * When a `focus` point is supplied (e.g. the selected hub), results are biased
 * to — and bounded within — its surrounding area so local venues/streets are
 * returned instead of far-away cities. Otherwise results are restricted to the
 * configured country when set.
 */
export async function geocode(query: string, focus?: GeoFocus): Promise<GeoResult[]> {
  if (!orsEnabled) {
    throw AppError.badRequest(
      'Address search requires an OpenRouteService API key (set ORS_API_KEY).'
    );
  }
  const params: Record<string, string | number> = {
    api_key: env.ors.apiKey!,
    text: query,
    size: 8,
  };
  if (focus) {
    params['focus.point.lat'] = focus.latitude;
    params['focus.point.lon'] = focus.longitude;
    params['boundary.circle.lat'] = focus.latitude;
    params['boundary.circle.lon'] = focus.longitude;
    params['boundary.circle.radius'] = env.ors.geocodeRadiusKm;
  } else if (env.ors.geocodeCountry) {
    params['boundary.country'] = env.ors.geocodeCountry;
  }
  try {
    const { data } = await axios.get(`${env.ors.baseUrl}/geocode/search`, {
      params,
      timeout: 15_000,
    });
    const features: any[] = data?.features ?? [];
    return features
      .filter((f) => Array.isArray(f?.geometry?.coordinates))
      .map((f) => ({
        label: f.properties?.label ?? query,
        longitude: f.geometry.coordinates[0],
        latitude: f.geometry.coordinates[1],
      }));
  } catch (err) {
    if (err instanceof AppError) throw err;
    const reason = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${err.message}`.trim()
      : (err as Error).message;
    throw AppError.upstream(`Geocoding failed: ${reason}`);
  }
}
