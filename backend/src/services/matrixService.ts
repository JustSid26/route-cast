import axios from 'axios';
import { env, orsEnabled } from '../config/env';
import { haversineMeters, LatLng } from '../utils/geo';

export interface MatrixResult {
  distances: number[][]; // meters
  durations: number[][]; // seconds
  source: 'openrouteservice' | 'haversine';
}

// Speed used to derive travel time when no road network is available.
const FALLBACK_SPEED_KMH = 30;

/** Pure-geometry matrix used when ORS is disabled or unreachable. */
function haversineMatrix(points: LatLng[]): MatrixResult {
  const n = points.length;
  const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const durations: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const mPerSec = (FALLBACK_SPEED_KMH * 1000) / 3600;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineMeters(points[i], points[j]);
      distances[i][j] = distances[j][i] = d;
      durations[i][j] = durations[j][i] = d / mPerSec;
    }
  }
  return { distances, durations, source: 'haversine' };
}

async function orsMatrix(points: LatLng[]): Promise<MatrixResult> {
  const locations = points.map((p) => [p.longitude, p.latitude]); // ORS uses [lon,lat]
  const url = `${env.ors.baseUrl}/v2/matrix/${env.ors.profile}`;
  const { data } = await axios.post(
    url,
    { locations, metrics: ['distance', 'duration'], units: 'm' },
    {
      headers: { Authorization: env.ors.apiKey!, 'Content-Type': 'application/json' },
      timeout: 20_000,
    }
  );
  if (!data?.distances || !data?.durations) {
    throw new Error('ORS matrix response missing distances/durations');
  }
  return {
    distances: data.distances,
    durations: data.durations,
    source: 'openrouteservice',
  };
}

/**
 * Build a full N×N distance + duration matrix for the given points
 * (index 0 conventionally the depot). Falls back to Haversine if ORS is
 * disabled or the API call fails, so optimisation never hard-fails on the
 * external dependency.
 */
export async function buildMatrix(points: LatLng[]): Promise<MatrixResult> {
  if (!orsEnabled) return haversineMatrix(points);
  try {
    return await orsMatrix(points);
  } catch (err) {
    const reason = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${err.message}`.trim()
      : (err as Error).message;
    console.warn(`[matrix] OpenRouteService failed (${reason}); falling back to Haversine`);
    return haversineMatrix(points);
  }
}
