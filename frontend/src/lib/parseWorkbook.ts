// Parse an uploaded Excel/CSV file into plain sheets (columns + rows) entirely
// in the browser, using SheetJS (already a dependency for export). The result is
// posted to the backend and stored whole, then rendered on the Inventory tab.

import * as XLSX from 'xlsx';
import { InventorySheet } from './types';

export type Cell = string | number | boolean | null;

export interface ParsedWorkbook {
  filename: string;
  sheets: InventorySheet[];
}

function normalize(v: unknown): Cell {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  return String(v);
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets: InventorySheet[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, blankrows: false, defval: null });
    if (!aoa.length) continue;

    const header = (aoa[0] as Cell[]).map((c) => (c == null ? '' : String(c)).trim());
    // Skip non-tabular sheets (e.g. a flowchart) — need at least 2 real headers.
    if (header.filter((h) => h).length < 2) continue;

    const width = header.length;
    const rows = (aoa.slice(1) as Cell[][])
      .map((r) => Array.from({ length: width }, (_, i) => normalize(r[i])))
      .filter((r) => r.some((c) => c !== null && c !== ''));

    sheets.push({ name, columns: header, rows });
  }

  if (!sheets.length) throw new Error('No tabular sheets found in this file.');
  return { filename: file.name, sheets };
}
