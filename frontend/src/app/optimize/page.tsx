'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, apiError } from '@/lib/api';
import { Objective, RouteJobDetail, OptimizeInput } from '@/lib/types';
import { formatDistance, formatDuration, formatWeight } from '@/lib/format';
import { deliveriesForHub } from '@/lib/geo';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';
import { SavingsPanel } from '@/components/SavingsPanel';

export default function OptimizePage() {
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.listVehicles });
  const deliveries = useQuery({ queryKey: ['deliveries'], queryFn: api.listDeliveries });

  const [depotId, setDepotId] = useState('');
  const [objective, setObjective] = useState<Objective>('distance');
  const [vehicleIds, setVehicleIds] = useState<Set<string>>(new Set());
  const [deliveryIds, setDeliveryIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<RouteJobDetail | null>(null);

  // Deliveries scoped to the chosen hub (their nearest depot), so picking a
  // hub shows and selects only that hub's stops.
  const hubDeliveries = deliveriesForHub(deliveries.data ?? [], depots.data ?? [], depotId);

  // Default selections once data loads.
  useEffect(() => {
    if (depots.data?.length && !depotId) setDepotId(depots.data[0].id);
  }, [depots.data, depotId]);
  useEffect(() => {
    if (vehicles.data) setVehicleIds(new Set(vehicles.data.filter((v) => v.active).map((v) => v.id)));
  }, [vehicles.data]);
  // When the hub (or delivery data) changes, select all of that hub's stops.
  useEffect(() => {
    setDeliveryIds(new Set(hubDeliveries.map((d) => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId, deliveries.data, depots.data]);

  // Pass inputs explicitly as mutation variables (captured at click time) so the
  // request always reflects the current objective/selection — no stale closure.
  const optimize = useMutation({
    mutationFn: (vars: OptimizeInput) => api.optimize(vars),
    onSuccess: (data) => setResult(data),
  });

  function runOptimization() {
    optimize.mutate({
      depot_id: depotId,
      objective,
      vehicle_ids: [...vehicleIds],
      delivery_ids: [...deliveryIds],
    });
  }

  // A shown result is "stale" if the objective toggle changed since it was run.
  const stale = !!result && result.job.objective !== objective;

  function toggle(set: Set<string>, id: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    apply(next);
  }

  const ready = depotId && vehicleIds.size > 0 && deliveryIds.size > 0;

  return (
    <div>
      <PageHeader title="Optimize Routes" subtitle="Generate capacity-aware routes with OR-Tools" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration */}
        <div className="space-y-5 lg:col-span-1">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">1 · Depot</h3>
            <select className="input" value={depotId} onChange={(e) => setDepotId(e.target.value)}>
              <option value="">Select depot…</option>
              {depots.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">2 · Objective</h3>
            <div className="flex gap-2">
              {(['distance', 'time'] as Objective[]).map((o) => (
                <button key={o}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    objective === o ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'
                  }`}
                  onClick={() => setObjective(o)}>
                  Minimize {o}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              3 · Vehicles ({vehicleIds.size}/{vehicles.data?.length ?? 0})
            </h3>
            <div className="max-h-40 space-y-1 overflow-auto">
              {vehicles.data?.map((v) => (
                <label key={v.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={vehicleIds.has(v.id)}
                    onChange={() => toggle(vehicleIds, v.id, setVehicleIds)} />
                  {v.name} <span className="text-xs text-slate-400">({formatWeight(v.capacity_kg)})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              4 · Deliveries ({deliveryIds.size}/{hubDeliveries.length})
            </h3>
            <p className="mb-2 text-xs text-slate-400">Stops nearest the selected hub.</p>
            <div className="max-h-40 space-y-1 overflow-auto">
              {hubDeliveries.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={deliveryIds.has(d.id)}
                    onChange={() => toggle(deliveryIds, d.id, setDeliveryIds)} />
                  {d.customer_name}
                </label>
              ))}
              {hubDeliveries.length === 0 && (
                <p className="text-xs text-slate-400">No deliveries near this hub yet.</p>
              )}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={!ready || optimize.isPending}
            onClick={runOptimization}>
            {optimize.isPending ? 'Optimizing…' : stale ? 'Re-run with new settings' : 'Run Optimization'}
          </button>
          {stale && (
            <p className="-mt-2 text-center text-xs text-amber-600">
              Objective changed — re-run to update the result.
            </p>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {optimize.isPending && <Spinner label="Building matrix and solving…" />}
          {optimize.error && <ErrorState message={apiError(optimize.error)} />}
          {!result && !optimize.isPending && (
            <div className="card flex h-full items-center justify-center py-20 text-center text-sm text-slate-400">
              Configure the inputs and run an optimization to see results here.
            </div>
          )}

          {result && (
            <div className="space-y-4">
            <div className="card overflow-hidden">
              {/* Compact summary bar */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-3 text-sm">
                <span className="badge bg-brand-50 capitalize text-brand-700">Minimize {result.job.objective}</span>
                <span><span className="text-slate-400">Vehicles</span> <b>{result.job.vehicle_count}</b></span>
                <span><span className="text-slate-400">Stops</span> <b>{result.job.stop_count}</b></span>
                <span><span className="text-slate-400">Distance</span> <b>{formatDistance(result.job.total_distance)}</b></span>
                <span><span className="text-slate-400">Time</span> <b>{formatDuration(result.job.total_time)}</b></span>
                <Link href={`/map?job=${result.job.id}`} className="ml-auto text-brand-600 hover:underline">
                  View on map →
                </Link>
              </div>

              {/* One compact row per vehicle */}
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Vehicle</th>
                    <th className="px-3 py-2 font-medium">Stops</th>
                    <th className="px-3 py-2 font-medium">Distance</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-5 py-2 font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.results.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                          {r.vehicle_name}
                        </div>
                        <div className="mt-0.5 max-w-[280px] truncate text-xs text-slate-400" title={r.stop_sequence.map((s) => s.customer_name).join(' → ')}>
                          Hub → {r.stop_sequence.map((s) => s.customer_name).join(' → ')} → Hub
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{r.stop_sequence.length}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDistance(r.total_distance)}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDuration(r.total_time)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.utilization_pct)}%`, background: r.color }} />
                          </div>
                          <span className="text-xs text-slate-500">{r.utilization_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SavingsPanel job={result.job} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
