'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { DispatchAssignment, DispatchPlan, Objective } from '@/lib/types';
import { formatDistance, formatDuration } from '@/lib/format';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';

const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => <Spinner label="Loading map…" />,
});

const STATUS: Record<DispatchAssignment['status'], { label: string; cls: string }> = {
  nearest: { label: '✓ nearest hub', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  fallback: { label: '↩ fallback', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  unfulfillable: { label: '✗ unfulfillable', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  no_order: { label: 'no order', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

function Kpi({ label, value, tone = 'text-slate-900' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function DispatchPage() {
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });
  const [objective, setObjective] = useState<Objective>('distance');
  const [depotIds, setDepotIds] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<DispatchPlan | null>(null);

  useEffect(() => { if (depots.data) setDepotIds(new Set(depots.data.map((d) => d.id))); }, [depots.data]);

  const run = useMutation({
    mutationFn: () => api.optimizeDispatch({ objective, depot_ids: [...depotIds] }),
    onSuccess: setPlan,
  });

  function toggle(id: string) {
    setDepotIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const mapResults = useMemo(() => plan?.plan.flatMap((p) => p.results) ?? [], [plan]);
  const mapDepots = useMemo(() => plan?.plan.map((p) => p.depot) ?? [], [plan]);

  return (
    <div>
      <PageHeader title="Dispatch" subtitle="Assign each order to the nearest warehouse with stock, then optimize routes" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Config */}
        <div className="space-y-5 lg:col-span-1">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Objective</h3>
            <div className="flex gap-2">
              {(['distance', 'time'] as Objective[]).map((o) => (
                <button key={o}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${objective === o ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}
                  onClick={() => setObjective(o)}>Minimize {o}</button>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Warehouses ({depotIds.size}/{depots.data?.length ?? 0})</h3>
            <p className="mb-2 text-xs text-slate-400">Orders are matched to the nearest of these that has the brand in stock.</p>
            <div className="max-h-56 space-y-1 overflow-auto">
              {depots.data?.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={depotIds.has(d.id)} onChange={() => toggle(d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full" disabled={depotIds.size === 0 || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? 'Dispatching…' : 'Run dispatch'}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {run.isPending && <Spinner label="Matching orders to stock & solving…" />}
          {run.error && <ErrorState message={apiError(run.error)} />}
          {!plan && !run.isPending && (
            <div className="card flex h-full items-center justify-center py-20 text-center text-sm text-slate-400">
              Pick warehouses and run dispatch to see order fulfillment + routes.
            </div>
          )}

          {plan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Orders" value={plan.summary.orders} />
                <Kpi label="At nearest hub" value={plan.summary.fulfilled} tone="text-emerald-700" />
                <Kpi label="Fallback" value={plan.summary.fallback} tone="text-amber-700" />
                <Kpi label="Unfulfillable" value={plan.summary.unfulfillable} tone="text-rose-700" />
              </div>

              <div className="card flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm">
                <span><span className="text-slate-400">Warehouses used</span> <b>{plan.summary.warehouses}</b></span>
                <span><span className="text-slate-400">Stops</span> <b>{plan.summary.stop_count}</b></span>
                <span><span className="text-slate-400">Distance</span> <b>{formatDistance(plan.summary.total_distance)}</b></span>
                <span><span className="text-slate-400">Time</span> <b>{formatDuration(plan.summary.total_time)}</b></span>
              </div>

              {mapDepots.length > 0 && (
                <div className="card overflow-hidden p-0">
                  <RouteMap depots={mapDepots} results={mapResults} />
                </div>
              )}

              {/* Fulfillment table */}
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Client</th>
                      <th className="px-3 py-2.5 font-medium">Order</th>
                      <th className="px-3 py-2.5 font-medium">Nearest hub</th>
                      <th className="px-3 py-2.5 font-medium">Assigned hub</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plan.assignments.map((a) => (
                      <tr key={a.delivery_id} className="align-top hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{a.customer_name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {a.order_qty > 0 ? <>{a.order_brand} <span className="text-xs text-slate-400">×{a.order_qty} · {a.order_category}</span></> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{a.nearest_depot_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{a.assigned_depot_name ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS[a.status].cls}`}>
                            {STATUS[a.status].label}
                          </span>
                          {a.reason && <div className="mt-0.5 text-[11px] text-slate-400">{a.reason}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Per-warehouse routes */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {plan.plan.map((p) => (
                  <div key={p.job.id} className="card p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: p.results[0]?.color ?? '#64748b' }} />
                      <span className="text-sm font-semibold text-slate-800">{p.depot.name}</span>
                      <Link href={`/map?job=${p.job.id}`} className="ml-auto text-xs text-brand-600 hover:underline">View on map →</Link>
                    </div>
                    <dl className="space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between"><dt>Stops</dt><dd>{p.job.stop_count}</dd></div>
                      <div className="flex justify-between"><dt>Distance</dt><dd>{formatDistance(p.job.total_distance)}</dd></div>
                      <div className="flex justify-between"><dt>Time</dt><dd>{formatDuration(p.job.total_time)}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
