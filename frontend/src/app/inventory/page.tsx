'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
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
  return [...set].sort();
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
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) upload.mutate(file);
  }

  function pickSheet(i: number) {
    setSel(i); setSearch(''); setCat('all'); setSort(null); setPage(0);
  }

  const data = inv.data as InventoryImport | null | undefined;
  const sheets = data?.data.sheets ?? [];
  const kpis = useMemo(() => (sheets.length ? computeKpis(sheets) : null), [sheets]);
  const sheet = sheets[sel];

  const catIdx = sheet ? colIndex(sheet, /category/i) : -1;
  const statusIdx = sheet ? colIndex(sheet, /status/i) : -1;
  const catOptions = useMemo(() => (sheet ? distinctValues(sheet, catIdx) : []), [sheet, catIdx]);

  const rows = useMemo(() => {
    if (!sheet) return [];
    let out = sheet.rows;
    if (cat !== 'all' && catIdx >= 0) out = out.filter((r) => cellStr(r[catIdx]) === cat);
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
  }, [sheet, cat, catIdx, search, sort]);

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

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input max-w-xs"
              placeholder={`Search ${sheet.name}…`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            {catIdx >= 0 && (
              <select className="input max-w-[12rem]" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
                <option value="all">All categories</option>
                {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
