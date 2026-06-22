// Client-side geo helpers for grouping deliveries by their nearest hub (depot).

import { Depot, Delivery } from './types';

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Id of the depot geographically closest to a delivery, or null if no depots. */
export function nearestDepotId(delivery: Delivery, depots: Depot[]): string | null {
  let best: { id: string; km: number } | null = null;
  for (const d of depots) {
    const km = haversineKm(delivery, d);
    if (!best || km < best.km) best = { id: d.id, km };
  }
  return best?.id ?? null;
}

/** Filter deliveries to those whose nearest depot is `hubId` ('' = all). */
export function deliveriesForHub(
  deliveries: Delivery[],
  depots: Depot[],
  hubId: string
): Delivery[] {
  if (!hubId) return deliveries;
  return deliveries.filter((d) => nearestDepotId(d, depots) === hubId);
}
