import axios from 'axios';
import { env, orsEnabled } from '../config/env';
import { LatLng } from '../utils/geo';

// Heavy commercial vehicles are banned from Mumbai's western coastal structures —
// the Bandra–Worli Sea Link and the new Coastal Road — and the western South-Mumbai
// sea-facing corridor. The HGV profile already drops the Sea Link, but the Coastal
// Road is too new to be tagged in the map data, so we hard-exclude that offshore/
// western strip (lon ≤ 72.812, lat 18.93–19.05) with an avoid-polygon. Trucks then
// approach from the east, as they must in reality. Our stops all sit east of it.
const TRUCK_AVOID_POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [72.780, 18.930],
    [72.812, 18.930],
    [72.812, 19.050],
    [72.780, 19.050],
    [72.780, 18.930],
  ]],
};

/**
 * Fetch the road-following polyline for an ordered list of waypoints (depot →
 * stops → depot) from the OpenRouteService Directions API.
 *
 * Returns the geometry as `[lat, lng]` pairs, or `null` when ORS is disabled,
 * the request fails, or there are too few waypoints — callers then fall back to
 * straight-line segments so a route is always drawable.
 */
export async function roadGeometry(waypoints: LatLng[]): Promise<[number, number][] | null> {
  if (!orsEnabled || waypoints.length < 2) return null;
  try {
    const url = `${env.ors.baseUrl}/v2/directions/${env.ors.profile}/geojson`;
    const { data } = await axios.post(
      url,
      {
        coordinates: waypoints.map((p) => [p.longitude, p.latitude]), // ORS uses [lon,lat]
        options: { avoid_polygons: TRUCK_AVOID_POLYGON },
      },
      {
        headers: { Authorization: env.ors.apiKey!, 'Content-Type': 'application/json' },
        timeout: 20_000,
      }
    );
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords)) return null;
    return coords.map((c: number[]) => [c[1], c[0]] as [number, number]); // → [lat,lng]
  } catch (err) {
    const reason = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${err.message}`.trim()
      : (err as Error).message;
    console.warn(`[directions] road geometry failed (${reason}); using straight lines`);
    return null;
  }
}
