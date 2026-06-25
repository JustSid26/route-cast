'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { parseWorkbook } from '@/lib/parseWorkbook';
import { InventoryImport, InventorySheet } from '@/lib/types';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';

type Cell = string | number | boolean | null;

// --- helpers ----------------------------------------------------------------
const colIndex = (s: InventorySheet, re: RegExp) => s.columns.findIndex((c) => re.test(c));
const cellStr = (c: Cell) => (c == null ? '' : String(c));

function distinctValues(s: InventorySheet, idx: number): string[] {
  if (idx < 0) return [];
  const set = new Set<string>();
  for (const r of s.rows) { const v = cellStr(r[idx]).trim(); if (v) set.add(v); }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// Columns worth offering as a filter dropdown. Known facets (alcohol type, brand,
// size, packaging, warehouse, status…) are recognised by name and allowed higher
// cardinality; other low-cardinality text columns are auto-detected too.
const FACET_HINT = /categor|brand|size|packag|status|warehouse|location|area|material|cap|type|available|variant|country|priorit/i;
const FACET_ORDER = ['categor', 'brand', 'size', 'packag', 'warehouse', 'location', 'area', 'status', 'material', 'cap', 'type', 'available', 'variant', 'country', 'priorit'];

function facetColumns(s: InventorySheet): number[] {
  const cols: number[] = [];
  s.columns.forEach((col, i) => {
    if (!col) return;
    const vals = s.rows.map((r) => cellStr(r[i]).trim()).filter(Boolean);
    if (vals.length < s.rows.length * 0.5) return;                 // mostly empty
    const distinct = new Set(vals).size;
    if (distinct < 2) return;                                       // single value
    const hinted = FACET_HINT.test(col);
    const numericShare = vals.filter((v) => Number.isFinite(Number(v))).length / vals.length;
    if (!hinted && numericShare > 0.5) return;                      // numeric measure, not a facet
    if (distinct > (hinted ? 80 : 25)) return;                      // too granular for a dropdown
    cols.push(i);
  });
  const prio = (h: string) => {
    const lc = h.toLowerCase();
    const idx = FACET_ORDER.findIndex((k) => lc.includes(k));
    return idx < 0 ? 99 : idx;
  };
  return cols.sort((a, b) => prio(s.columns[a]) - prio(s.columns[b]) || a - b);
}

// Warehouse → set of categories it stocks, from a "Warehouse Stock by Category"
// style sheet (a sheet carrying both a warehouse and a category column). Lets the
// product/SKU view be filtered by warehouse via the category link, since SKUs
// aren't tied to warehouses directly in the data.
function buildWarehouseCategoryMap(sheets: InventorySheet[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const stock = sheets.find((s) => colIndex(s, /warehouse/i) >= 0 && colIndex(s, /category/i) >= 0);
  if (!stock) return map;
  const wIdx = colIndex(stock, /warehouse.*name/i) >= 0 ? colIndex(stock, /warehouse.*name/i) : colIndex(stock, /warehouse/i);
  const cIdx = colIndex(stock, /category/i);
  const qIdx = colIndex(stock, /bottle|stock|qty|quantity/i);
  for (const r of stock.rows) {
    const w = cellStr(r[wIdx]).trim();
    const c = cellStr(r[cIdx]).trim();
    if (!w || !c) continue;
    if (qIdx >= 0) { const n = Number(r[qIdx]); if (Number.isFinite(n) && n <= 0) continue; }
    if (!map.has(w)) map.set(w, new Set());
    map.get(w)!.add(c);
  }
  return map;
}

function computeKpis(sheets: InventorySheet[]) {
  const product = sheets.find((s) => /sku|product/i.test(s.name))
    ?? [...sheets].sort((a, b) => b.rows.length - a.rows.length)[0];
  const inventory = sheets.find((s) => /inventor|stock/i.test(s.name));

  const catIdx = product ? colIndex(product, /category/i) : -1;
  const statusIdx = product ? colIndex(product, /status/i) : -1;

  let stockUnits: number | null = null;
  if (inventory) {
    const sIdx = colIndex(inventory, /closing.*stock/i) >= 0
      ? colIndex(inventory, /closing.*stock/i)
      : colIndex(inventory, /stock|qty|quantity/i);
    if (sIdx >= 0) {
      stockUnits = inventory.rows.reduce((sum, r) => {
        const n = Number(r[sIdx]); return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
    }
  }

  const outOfStock = statusIdx >= 0 && product
    ? product.rows.filter((r) => /out.?of.?stock/i.test(cellStr(r[statusIdx]))).length
    : null;

  return {
    productName: product?.name ?? null,
    totalSkus: product?.rows.length ?? null,
    categories: catIdx >= 0 && product ? distinctValues(product, catIdx).length : null,
    stockUnits,
    outOfStock,
  };
}

function badgeClass(value: string): string {
  const v = value.toLowerCase();
  if (/active|in stock|operational/.test(v)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (/out of stock|maintenance|inactive/.test(v)) return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (/discontinued|near capacity/.test(v)) return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

const PAGE_SIZE = 20;

function Kpi({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold text-slate-900">
        {value == null ? '—' : value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

// --- page -------------------------------------------------------------------
export default function InventoryPage() {
  const qc = useQueryClient();
  const inv = useQuery({ queryKey: ['inventory'], queryFn: api.getInventory });
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => api.importInventory(await parseWorkbook(file)),
    onSuccess: () => { setSel(0); qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });

  const [sel, setSel] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [wh, setWh] = useState(''); // cross-sheet warehouse filter (by category link)
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) upload.mutate(file);
  }

  function pickSheet(i: number) {
    setSel(i); setSearch(''); setFilters({}); setWh(''); setSort(null); setPage(0);
  }

  function setFilter(idx: number, val: string) {
    setPage(0);
    setFilters((f) => {
      const next = { ...f };
      if (val) next[idx] = val; else delete next[idx];
      return next;
    });
  }

  const data = inv.data as InventoryImport | null | undefined;
  const sheets = data?.data.sheets ?? [];

  // Open on the product / SKU sheet (where alcohol type / brand / bottle size /
  // packaging / status filters live) rather than the first sheet.
  useEffect(() => {
    const i = sheets.findIndex((s) => /sku|product/i.test(s.name));
    setSel(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);
  const kpis = useMemo(() => (sheets.length ? computeKpis(sheets) : null), [sheets]);
  const sheet = sheets[sel];

  const statusIdx = sheet ? colIndex(sheet, /status/i) : -1;
  const facets = useMemo(() => (sheet ? facetColumns(sheet) : []), [sheet]);

  // Cross-sheet warehouse filter: only on sheets that have a Category column but
  // no warehouse column of their own (e.g. the product/SKU sheet).
  const warehouseCats = useMemo(() => buildWarehouseCategoryMap(sheets), [sheets]);
  const activeCatIdx = sheet ? colIndex(sheet, /category/i) : -1;
  const showWarehouseFilter =
    warehouseCats.size > 0 && activeCatIdx >= 0 && (sheet ? colIndex(sheet, /warehouse/i) < 0 : false);
  const activeCount = Object.values(filters).filter(Boolean).length + (showWarehouseFilter && wh ? 1 : 0);

  // Cascading facet options: each dropdown only offers values that still exist
  // given the OTHER active filters (+ warehouse + search). The facet's own
  // current selection is kept so it never disappears.
  const facetOptions = useMemo(() => {
    const m: Record<number, string[]> = {};
    if (!sheet) return m;
    for (const f of facets) {
      const set = new Set<string>();
      for (const r of sheet.rows) {
        let ok = true;
        for (const [idxStr, val] of Object.entries(filters)) {
          if (!val || Number(idxStr) === f) continue;
          if (cellStr(r[Number(idxStr)]) !== val) { ok = false; break; }
        }
        if (ok && showWarehouseFilter && wh) {
          const cats = warehouseCats.get(wh);
          if (cats && !cats.has(cellStr(r[activeCatIdx]).trim())) ok = false;
        }
        if (ok && search.trim()) {
          const q = search.toLowerCase();
          if (!r.some((c) => cellStr(c).toLowerCase().includes(q))) ok = false;
        }
        if (ok) { const v = cellStr(r[f]).trim(); if (v) set.add(v); }
      }
      if (filters[f]) set.add(filters[f]);
      m[f] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return m;
  }, [sheet, facets, filters, wh, showWarehouseFilter, activeCatIdx, warehouseCats, search]);

  const rows = useMemo(() => {
    if (!sheet) return [];
    let out = sheet.rows;
    for (const [idxStr, val] of Object.entries(filters)) {
      if (!val) continue;
      const idx = Number(idxStr);
      out = out.filter((r) => cellStr(r[idx]) === val);
    }
    if (showWarehouseFilter && wh) {
      const cats = warehouseCats.get(wh);
      if (cats) out = out.filter((r) => cats.has(cellStr(r[activeCatIdx]).trim()));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.some((c) => cellStr(c).toLowerCase().includes(q)));
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        const nx = Number(x), ny = Number(y);
        const both = Number.isFinite(nx) && Number.isFinite(ny);
        const cmp = both ? nx - ny : cellStr(x).localeCompare(cellStr(y));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [sheet, filters, wh, showWarehouseFilter, activeCatIdx, warehouseCats, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pages - 1);
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(col: number) {
    setPage(0);
    setSort((s) => (s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  }

  const uploadBtn = (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? 'Importing…' : data ? 'Upload new file' : 'Upload Excel'}
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Upload an Excel workbook — every sheet is extracted and shown here"
        action={data ? uploadBtn : undefined}
      />

      {upload.error && <div className="mb-3"><ErrorState message={apiError(upload.error)} /></div>}
      {inv.isLoading && <Spinner label="Loading inventory…" />}

      {/* Empty state */}
      {!inv.isLoading && !data && (
        <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="text-sm font-medium text-slate-600">No inventory uploaded yet</div>
          <p className="max-w-md text-xs text-slate-400">
            Upload an .xlsx / .csv (e.g. a product / SKU master). Every sheet is parsed, stored, and
            shown as a searchable inventory — KPIs, status badges, filters and all.
          </p>
          {uploadBtn}
        </div>
      )}

      {data && sheet && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total SKUs" value={kpis?.totalSkus ?? null} />
            <Kpi label="Stock units" value={kpis?.stockUnits ?? null} />
            <Kpi label="Categories" value={kpis?.categories ?? null} />
            <Kpi label="Out of stock" value={kpis?.outOfStock ?? null} />
          </div>

          <div className="text-xs text-slate-400">
            <span className="font-medium text-slate-600">{data.filename}</span>
            {' · '}{data.sheet_count} sheets · {data.row_count.toLocaleString('en-IN')} rows · uploaded{' '}
            {new Date(data.created_at).toLocaleString()}
          </div>

          {/* Sheet tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            {sheets.map((s, i) => (
              <button
                key={s.name}
                onClick={() => pickSheet(i)}
                className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  i === sel
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {s.name} <span className="text-xs text-slate-400">({s.rows.length})</span>
              </button>
            ))}
          </div>

          {/* Toolbar — search + auto-detected facet dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input max-w-xs"
              placeholder={`Search ${sheet.name}…`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            {showWarehouseFilter && (
              <select
                className="input w-auto max-w-[14rem] font-medium text-brand-700"
                value={wh}
                onChange={(e) => { setWh(e.target.value); setPage(0); }}
                title="Filter to products in categories stocked at this warehouse"
              >
                <option value="">All warehouses</option>
                {[...warehouseCats.keys()].sort().map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            )}
            {facets.map((idx) => (
              <select
                key={idx}
                className="input w-auto max-w-[12rem]"
                value={filters[idx] ?? ''}
                onChange={(e) => setFilter(idx, e.target.value)}
              >
                <option value="">All {sheet.columns[idx]}</option>
                {facetOptions[idx]?.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ))}
            {activeCount > 0 && (
              <button
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={() => { setFilters({}); setWh(''); setPage(0); }}
              >
                Clear filters ({activeCount})
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">
              {rows.length.toLocaleString('en-IN')} of {sheet.rows.length.toLocaleString('en-IN')} rows
            </span>
          </div>

          {/* Table */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {sheet.columns.map((c, ci) => (
                    <th
                      key={ci}
                      onClick={() => toggleSort(ci)}
                      className="cursor-pointer whitespace-nowrap px-3 py-2.5 font-medium hover:text-slate-800"
                    >
                      {c}
                      {sort?.col === ci && <span className="ml-1">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r, ri) => (
                  <tr key={ri} className="hover:bg-slate-50">
                    {r.map((c, ci) => (
                      <td key={ci} className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {ci === statusIdx && cellStr(c) ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${badgeClass(cellStr(c))}`}>
                            {cellStr(c)}
                          </span>
                        ) : (
                          cellStr(c)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={sheet.columns.length} className="px-3 py-10 text-center text-sm text-slate-400">No matching rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <button className="btn-secondary" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>Prev</button>
              <span className="text-xs text-slate-500">Page {clampedPage + 1} of {pages}</span>
              <button className="btn-secondary" disabled={clampedPage >= pages - 1} onClick={() => setPage(clampedPage + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
