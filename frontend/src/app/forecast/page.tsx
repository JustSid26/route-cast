'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { buildForecast, byUrgency, DemandBasis, ForecastRow, ForecastStatus } from '@/lib/forecast';
import { PageHeader, Spinner } from '@/components/ui';

const PAGE_SIZE = 20;

const STATUS_META: Record<ForecastStatus, { label: string; cls: string }> = {
  out: { label: 'Out of stock', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  critical: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  low: { label: 'Low', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  nodemand: { label: 'No demand', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

const BASES: { key: DemandBasis; label: string }[] = [
  { key: '1mo', label: 'Last month' },
  { key: '3mo', label: 'Last 3 months' },
  { key: '6mo', label: 'All 6 months' },
];

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value.toLocaleString('en-IN')}</div>
    </div>
  );
}

function daysLabel(r: ForecastRow): string {
  if (r.status === 'out') return '0 — out';
  if (r.daysToStockout == null) return '—';
  return `${r.daysToStockout.toLocaleString('en-IN')} days`;
}

export default function ForecastPage() {
  const inv = useQuery({ queryKey: ['inventory'], queryFn: api.getInventory });
  const [basis, setBasis] = useState<DemandBasis>('3mo');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [page, setPage] = useState(0);

  const result = useMemo(() => buildForecast(inv.data, basis), [inv.data, basis]);

  const categories = useMemo(
    () => [...new Set(result.rows.map((r) => r.category).filter(Boolean))].sort(),
    [result.rows]
  );

  const counts = useMemo(() => {
    const c = { out: 0, critical: 0, low: 0, healthy: 0, nodemand: 0 };
    for (const r of result.rows) c[r.status]++;
    return c;
  }, [result.rows]);

  const rows = useMemo(() => {
    let out = [...result.rows].sort(byUrgency);
    if (cat !== 'all') out = out.filter((r) => r.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => `${r.sku} ${r.brand} ${r.category}`.toLowerCase().includes(q));
    }
    return out;
  }, [result.rows, cat, search]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clamped = Math.min(page, pages - 1);
  const pageRows = rows.slice(clamped * PAGE_SIZE, clamped * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Demand Forecast"
        subtitle="Projected days until each SKU runs out, from stock on hand and past sales"
      />

      {inv.isLoading && <Spinner label="Scanning inventory…" />}

      {!inv.isLoading && !inv.data && (
        <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="text-sm font-medium text-slate-600">No inventory to forecast</div>
          <p className="max-w-md text-xs text-slate-400">
            Upload a workbook with an <b>Inventory</b> sheet (current stock) and a <b>Sales</b> sheet
            (monthly history) on the Inventory tab first.
          </p>
          <Link href="/inventory" className="btn-primary">Go to Inventory</Link>
        </div>
      )}

      {inv.data && !result.ok && (
        <div className="card px-5 py-4 text-sm text-amber-700">{result.message}</div>
      )}

      {inv.data && result.ok && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Out of stock" value={counts.out} tone="text-rose-700" />
            <Kpi label="Critical (< 7 days)" value={counts.critical} tone="text-rose-700" />
            <Kpi label="Low (< 30 days)" value={counts.low} tone="text-amber-700" />
            <Kpi label="Healthy (30+ days)" value={counts.healthy} tone="text-emerald-700" />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
              {BASES.map((b) => (
                <button
                  key={b.key}
                  onClick={() => { setBasis(b.key); setPage(0); }}
                  className={`px-3 py-1.5 font-medium ${
                    basis === b.key ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <input
              className="input max-w-xs"
              placeholder="Search SKU / brand / category…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            {categories.length > 0 && (
              <select className="input max-w-[12rem]" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <span className="ml-auto text-xs text-slate-400">
              Demand basis: avg over last {result.monthsUsed} month{result.monthsUsed > 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  <th className="px-3 py-2.5 font-medium">Brand</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg / day</th>
                  <th className="px-3 py-2.5 text-right font-medium">Days to stockout</th>
                  <th className="px-3 py-2.5 font-medium">Est. stockout</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((r) => (
                  <tr key={r.sku} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{r.sku}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.brand}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.category}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.currentStock.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.avgDailySales}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      r.status === 'out' || r.status === 'critical' ? 'text-rose-600'
                        : r.status === 'low' ? 'text-amber-600' : 'text-slate-700'
                    }`}>{daysLabel(r)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.stockoutDate ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_META[r.status].cls}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-400">No matching SKUs.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <button className="btn-secondary" disabled={clamped === 0} onClick={() => setPage(clamped - 1)}>Prev</button>
              <span className="text-xs text-slate-500">Page {clamped + 1} of {pages}</span>
              <button className="btn-secondary" disabled={clamped >= pages - 1} onClick={() => setPage(clamped + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
