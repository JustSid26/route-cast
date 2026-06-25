// Demand forecasting from a persisted inventory import: join current stock
// (Inventory sheet) with past monthly sales (Sales sheet) per SKU, derive an
// average daily demand, and project how many days until each SKU runs out.

import { InventoryImport, InventorySheet } from './types';

export type DemandBasis = '6mo' | '3mo' | '1mo';
export type ForecastStatus = 'out' | 'critical' | 'low' | 'healthy' | 'nodemand';

export interface ForecastRow {
  sku: string;
  brand: string;
  category: string;
  currentStock: number;
  avgDailySales: number;
  daysToStockout: number | null; // null → no recent demand (won't deplete)
  stockoutDate: string | null;   // ISO yyyy-mm-dd, or null
  status: ForecastStatus;
}

export interface ForecastResult {
  ok: boolean;
  message?: string;
  rows: ForecastRow[];
  monthsUsed: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const cellStr = (c: unknown) => (c == null ? '' : String(c));
const toNum = (c: unknown) => { const n = Number(c); return Number.isFinite(n) ? n : 0; };

const findSheet = (sheets: InventorySheet[], re: RegExp) => sheets.find((s) => re.test(s.name));
const colIndex = (s: InventorySheet, re: RegExp) => s.columns.findIndex((c) => re.test(c));
const daysInMonth = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();

interface MonthCol { idx: number; year: number; month: number; days: number; }

/** Detect month columns like "Jan 2026" in the sales sheet, chronologically. */
function monthColumns(sales: InventorySheet, asOf: Date): MonthCol[] {
  const cols: MonthCol[] = [];
  sales.columns.forEach((h, idx) => {
    const m = h.toLowerCase().match(/([a-z]{3,})\s*'?(\d{2,4})?/);
    if (!m) return;
    const month = MONTHS.indexOf(m[1].slice(0, 3));
    if (month < 0) return;
    let year = m[2] ? Number(m[2]) : asOf.getFullYear();
    if (year < 100) year += 2000;
    cols.push({ idx, year, month, days: daysInMonth(year, month) });
  });
  return cols.sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

const basisCount: Record<DemandBasis, number> = { '6mo': 6, '3mo': 3, '1mo': 1 };

export function buildForecast(
  inv: InventoryImport | null | undefined,
  basis: DemandBasis = '3mo',
  asOf: Date = new Date()
): ForecastResult {
  const sheets = inv?.data.sheets ?? [];
  const sales = findSheet(sheets, /sale/i);
  const inventory = findSheet(sheets, /inventor|stock/i);

  if (!sales) return { ok: false, message: 'No "Sales" sheet found — a monthly sales sheet is required to forecast demand.', rows: [], monthsUsed: 0 };
  if (!inventory) return { ok: false, message: 'No "Inventory" sheet found — a stock sheet is required to forecast depletion.', rows: [], monthsUsed: 0 };

  const allMonths = monthColumns(sales, asOf);
  if (!allMonths.length) return { ok: false, message: 'Could not find monthly columns (e.g. "Jan 2026") in the Sales sheet.', rows: [], monthsUsed: 0 };
  const months = allMonths.slice(-basisCount[basis]);
  const totalDays = months.reduce((s, m) => s + m.days, 0);

  // Stock by SKU from the Inventory sheet.
  const invSkuIdx = colIndex(inventory, /sku/i);
  const stockIdx = colIndex(inventory, /closing.*stock/i) >= 0
    ? colIndex(inventory, /closing.*stock/i)
    : colIndex(inventory, /stock|qty|quantity/i);
  const stockBySku = new Map<string, number>();
  if (invSkuIdx >= 0 && stockIdx >= 0) {
    for (const r of inventory.rows) {
      const key = cellStr(r[invSkuIdx]).trim().toLowerCase();
      if (key) stockBySku.set(key, toNum(r[stockIdx]));
    }
  }

  const skuIdx = colIndex(sales, /sku/i);
  const brandIdx = colIndex(sales, /brand/i);
  const catIdx = colIndex(sales, /category/i);

  const rows: ForecastRow[] = sales.rows.map((r) => {
    const sku = cellStr(r[skuIdx >= 0 ? skuIdx : 0]).trim();
    const totalSales = months.reduce((s, m) => s + toNum(r[m.idx]), 0);
    const avgDaily = totalDays > 0 ? totalSales / totalDays : 0;
    const currentStock = stockBySku.get(sku.toLowerCase()) ?? 0;

    let daysToStockout: number | null = null;
    let status: ForecastStatus;
    if (currentStock <= 0) { status = 'out'; daysToStockout = 0; }
    else if (avgDaily <= 0) { status = 'nodemand'; daysToStockout = null; }
    else {
      daysToStockout = currentStock / avgDaily;
      status = daysToStockout < 7 ? 'critical' : daysToStockout < 30 ? 'low' : 'healthy';
    }

    let stockoutDate: string | null = null;
    if (daysToStockout != null) {
      const d = new Date(asOf);
      d.setDate(d.getDate() + Math.round(daysToStockout));
      stockoutDate = d.toISOString().slice(0, 10);
    }

    return {
      sku,
      brand: brandIdx >= 0 ? cellStr(r[brandIdx]) : '',
      category: catIdx >= 0 ? cellStr(r[catIdx]) : '',
      currentStock,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      daysToStockout: daysToStockout == null ? null : Math.round(daysToStockout),
      stockoutDate,
      status,
    };
  });

  return { ok: true, rows, monthsUsed: months.length };
}

export const statusRank: Record<ForecastStatus, number> = {
  out: 0, critical: 1, low: 2, healthy: 3, nodemand: 4,
};

/** Urgency sort: out-of-stock first, then soonest to deplete, no-demand last. */
export function byUrgency(a: ForecastRow, b: ForecastRow): number {
  const av = a.daysToStockout ?? Infinity;
  const bv = b.daysToStockout ?? Infinity;
  return av - bv || statusRank[a.status] - statusRank[b.status];
}
