// Build a CSV of an optimized plan — one ordered row per leg per vehicle
// (depart depot → deliveries in sequence → return depot) — and download it.
// Also builds per-driver route sheets (PDF + XLSX), one truck each.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { RouteJobDetail, Depot, RouteResult } from './types';
import { formatDistance, formatDuration, formatWeight } from './format';

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildRouteCsv(detail: RouteJobDetail, depots: Depot[]): string {
  const header = [
    'vehicle', 'depot', 'sequence', 'type', 'location', 'latitude', 'longitude',
    'weight_kg', 'vehicle_total_km', 'vehicle_total_min', 'utilization_pct',
  ];
  const rows: (string | number)[][] = [header];
  const depotById = new Map(depots.map((d) => [d.id, d]));

  for (const r of detail.results) {
    const totalKm = (r.total_distance / 1000).toFixed(2);
    const totalMin = Math.round(r.total_time / 60);
    // Each vehicle departs from / returns to its own home depot (multi-depot).
    const depot = (r.depot_id ? depotById.get(r.depot_id) : null) ?? depots[0] ?? null;
    const depName = depot?.name ?? 'Depot';
    const depLat = depot?.latitude ?? '';
    const depLng = depot?.longitude ?? '';

    rows.push([r.vehicle_name, depName, 0, 'Depart depot', depName, depLat, depLng, '', totalKm, totalMin, r.utilization_pct]);
    for (const s of r.stop_sequence) {
      rows.push([r.vehicle_name, depName, s.sequence, 'Delivery', s.customer_name, s.latitude, s.longitude, s.weight, totalKm, totalMin, r.utilization_pct]);
    }
    rows.push([r.vehicle_name, depName, r.stop_sequence.length + 1, 'Return depot', depName, depLat, depLng, '', totalKm, totalMin, r.utilization_pct]);
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

// --- Per-driver route sheets (one truck per file) ---------------------------
// A driver wants their own truck's stops, in order, with where to leave from and
// the totals — printable (PDF) or as a spreadsheet (XLSX). Address isn't carried
// on the route stop, so callers pass a delivery_id → address lookup.

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'vehicle';
}

/** Ordered [#, customer, address, weight-kg] rows for one vehicle's stops. */
function stopRows(r: RouteResult, addrById: Map<string, string>): (string | number)[][] {
  return r.stop_sequence.map((s) => [
    s.sequence,
    s.customer_name,
    addrById.get(s.delivery_id) ?? '',
    s.weight,
  ]);
}

function summaryLine(r: RouteResult): string {
  return `Stops: ${r.stop_sequence.length}    Distance: ${formatDistance(r.total_distance)}    Time: ${formatDuration(r.total_time)}    Load: ${formatWeight(r.load_kg)} (${r.utilization_pct}%)`;
}

/** Print-friendly PDF for a single truck: header, numbered stops, totals. */
export function buildVehiclePdf(r: RouteResult, depot: Depot | null, addrById: Map<string, string>) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Route sheet — ${r.vehicle_name}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Depart from: ${depot?.name ?? 'Depot'}`, 14, 26);
  doc.text(summaryLine(r), 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Customer', 'Address', 'Weight']],
    body: stopRows(r, addrById).map((row) => [row[0], row[1], row[2], formatWeight(Number(row[3]))]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 12 }, 3: { halign: 'right' } },
  });

  doc.save(`route-${slug(r.vehicle_name)}.pdf`);
}

/** Single-sheet XLSX workbook for one truck. */
export function buildVehicleXlsx(r: RouteResult, depot: Depot | null, addrById: Map<string, string>) {
  const aoa: (string | number)[][] = [
    [`Route sheet — ${r.vehicle_name}`],
    [`Depart from: ${depot?.name ?? 'Depot'}`],
    [summaryLine(r)],
    [],
    ['#', 'Customer', 'Address', 'Weight (kg)', 'Latitude', 'Longitude'],
    ...r.stop_sequence.map((s) => [
      s.sequence, s.customer_name, addrById.get(s.delivery_id) ?? '', s.weight, s.latitude, s.longitude,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  // Excel sheet names: max 31 chars, no \ / ? * [ ] :
  const sheetName = r.vehicle_name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Route';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `route-${slug(r.vehicle_name)}.xlsx`);
}
