// Build a CSV of an optimized plan — one ordered row per leg per vehicle
// (depart depot → deliveries in sequence → return depot) — and download it.

import { RouteJobDetail, Depot } from './types';

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildRouteCsv(detail: RouteJobDetail, depot: Depot | null): string {
  const header = [
    'vehicle', 'sequence', 'type', 'location', 'latitude', 'longitude',
    'weight_kg', 'vehicle_total_km', 'vehicle_total_min', 'utilization_pct',
  ];
  const rows: (string | number)[][] = [header];

  for (const r of detail.results) {
    const totalKm = (r.total_distance / 1000).toFixed(2);
    const totalMin = Math.round(r.total_time / 60);
    const depName = depot?.name ?? 'Depot';
    const depLat = depot?.latitude ?? '';
    const depLng = depot?.longitude ?? '';

    rows.push([r.vehicle_name, 0, 'Depart depot', depName, depLat, depLng, '', totalKm, totalMin, r.utilization_pct]);
    for (const s of r.stop_sequence) {
      rows.push([r.vehicle_name, s.sequence, 'Delivery', s.customer_name, s.latitude, s.longitude, s.weight, totalKm, totalMin, r.utilization_pct]);
    }
    rows.push([r.vehicle_name, r.stop_sequence.length + 1, 'Return depot', depName, depLat, depLng, '', totalKm, totalMin, r.utilization_pct]);
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
