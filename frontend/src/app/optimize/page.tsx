'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, apiError } from '@/lib/api';
import { Objective, RouteJobDetail, OptimizeInput } from '@/lib/types';
import { formatDistance, formatDuration, formatWeight } from '@/lib/format';
import { nearestDepotId } from '@/lib/geo';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';
import { SavingsPanel } from '@/components/SavingsPanel';
import { buildRouteCsv, downloadCsv, buildVehiclePdf, buildVehicleXlsx } from '@/lib/export';

// A four-step guided flow so a non-technical user can build a plan by answering
// plain questions. The optimisation, calculations and proof panel are unchanged
// underneath — only the way you set it up is friendlier.
const STEPS = [
  { title: 'Starting points', question: 'Where do the trucks start from?' },
  { title: 'Deliveries', question: 'What are we delivering today?' },
  { title: 'Trucks', question: 'Which trucks, and from which depot?' },
  { title: 'Goal', question: 'What matters most for this plan?' },
] as const;

export default function OptimizePage() {
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.listVehicles });
  const deliveries = useQuery({ queryKey: ['deliveries'], queryFn: api.listDeliveries });

  const [step, setStep] = useState(0);
  const [depotIds, setDepotIds] = useState<Set<string>>(new Set());
  const [deliveryIds, setDeliveryIds] = useState<Set<string>>(new Set());
  const [vehicleIds, setVehicleIds] = useState<Set<string>>(new Set());
  // vehicle_id → depot_id it departs from (manual assignment).
  const [vehicleDepot, setVehicleDepot] = useState<Record<string, string>>({});
  const [objective, setObjective] = useState<Objective>('distance');
  const [result, setResult] = useState<RouteJobDetail | null>(null);

  // Sensible starting selections once data loads: first depot, all stops, all
  // active trucks spread evenly across the chosen depots.
  useEffect(() => {
    if (depots.data?.length && depotIds.size === 0) setDepotIds(new Set([depots.data[0].id]));
  }, [depots.data, depotIds.size]);
  useEffect(() => {
    if (deliveries.data && deliveryIds.size === 0) {
      setDeliveryIds(new Set(deliveries.data.map((d) => d.id)));
    }
  }, [deliveries.data, deliveryIds.size]);
  useEffect(() => {
    if (vehicles.data && vehicleIds.size === 0) {
      setVehicleIds(new Set(vehicles.data.filter((v) => v.active).map((v) => v.id)));
    }
  }, [vehicles.data, vehicleIds.size]);

  const selectedDepots = useMemo(
    () => (depots.data ?? []).filter((d) => depotIds.has(d.id)),
    [depots.data, depotIds]
  );
  const selectedVehicles = useMemo(
    () => (vehicles.data ?? []).filter((v) => vehicleIds.has(v.id)),
    [vehicles.data, vehicleIds]
  );

  // Keep every selected truck assigned to one of the selected depots. Anything
  // unassigned (or pointing at a now-deselected depot) is spread round-robin.
  useEffect(() => {
    if (selectedDepots.length === 0) return;
    setVehicleDepot((prev) => {
      const next = { ...prev };
      let i = 0;
      for (const v of selectedVehicles) {
        const current = next[v.id];
        if (!current || !depotIds.has(current)) {
          next[v.id] = selectedDepots[i % selectedDepots.length].id;
          i++;
        }
      }
      // Drop assignments for vehicles no longer selected.
      for (const id of Object.keys(next)) if (!vehicleIds.has(id)) delete next[id];
      return next;
    });
  }, [selectedVehicles, selectedDepots, depotIds, vehicleIds]);

  const optimize = useMutation({
    mutationFn: (vars: OptimizeInput) => api.optimize(vars),
    onSuccess: (data) => setResult(data),
  });

  function toggle(set: Set<string>, id: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    apply(next);
  }

  const stepValid = [
    depotIds.size > 0,
    deliveryIds.size > 0,
    vehicleIds.size > 0 && selectedVehicles.every((v) => depotIds.has(vehicleDepot[v.id])),
    true,
  ];
  const canRun = stepValid.every(Boolean);

  function runOptimization() {
    optimize.mutate({
      objective,
      assignments: selectedVehicles.map((v) => ({ vehicle_id: v.id, depot_id: vehicleDepot[v.id] })),
      delivery_ids: [...deliveryIds],
    });
  }

  // Per-result depot lookup for the results table + driver sheets.
  const depotById = new Map((depots.data ?? []).map((d) => [d.id, d] as const));
  const depotFor = (r: { depot_id: string | null }) =>
    (r.depot_id ? depotById.get(r.depot_id) : null) ?? (result ? depotById.get(result.job.depot_id ?? '') ?? null : null);
  const addrById = new Map((deliveries.data ?? []).map((d) => [d.id, d.address] as const));

  const loading = depots.isLoading || vehicles.isLoading || deliveries.isLoading;

  return (
    <div>
      <PageHeader title="Plan routes" subtitle="Answer a few questions and we'll build the best plan for your trucks." />

      {loading && <Spinner label="Loading your depots, trucks and deliveries…" />}

      {!loading && (
        <div className="mx-auto max-w-3xl">
          {/* Step indicator */}
          <ol className="mb-5 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const state = i === step ? 'current' : i < step ? 'done' : 'todo';
              return (
                <li key={s.title} className="flex flex-1 items-center gap-2">
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                      state === 'current'
                        ? 'bg-brand-600 text-white'
                        : state === 'done'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </button>
                  <span className={`hidden text-xs font-medium sm:block ${i === step ? 'text-slate-800' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
                </li>
              );
            })}
          </ol>

          <div className="card p-6">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-600">
              Step {step + 1} of {STEPS.length}
            </div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{STEPS[step].question}</h2>

            {/* Step 1 — depots */}
            {step === 0 && (
              <div>
                <p className="mb-3 text-sm text-slate-500">
                  Pick one or more depots. Each truck will set out from a depot and return to it. Choose several to plan across multiple hubs at once.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {depots.data?.map((d) => {
                    const on = depotIds.has(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => toggle(depotIds, d.id, setDepotIds)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          on ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                          {on && <span className="text-xs">✓</span>}
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-slate-800">{d.name}</span>
                          {d.address && <span className="block text-xs text-slate-400">{d.address}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {depots.data?.length === 0 && (
                  <p className="text-sm text-slate-400">No depots yet — add one on the Depots page first.</p>
                )}
              </div>
            )}

            {/* Step 2 — deliveries */}
            {step === 1 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Tick the stops to include. {deliveryIds.size} of {deliveries.data?.length ?? 0} selected.
                  </p>
                  <div className="flex gap-3 text-xs">
                    <button className="text-brand-600 hover:underline" onClick={() => setDeliveryIds(new Set((deliveries.data ?? []).map((d) => d.id)))}>Select all</button>
                    <button className="text-slate-500 hover:underline" onClick={() => setDeliveryIds(new Set())}>Clear</button>
                  </div>
                </div>
                <div className="max-h-72 space-y-1 overflow-auto rounded-lg border border-slate-100 p-1">
                  {deliveries.data?.map((d) => {
                    const on = deliveryIds.has(d.id);
                    const near = depots.data ? nearestDepotId(d, depots.data) : null;
                    const nearName = near ? depots.data?.find((x) => x.id === near)?.name : null;
                    return (
                      <label key={d.id} className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm ${on ? 'bg-brand-50/60' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(deliveryIds, d.id, setDeliveryIds)} />
                        <span className="flex-1 text-slate-700">{d.customer_name}</span>
                        <span className="text-xs text-slate-400">{formatWeight(d.weight)}</span>
                        {nearName && <span className="hidden text-xs text-slate-400 md:block">near {nearName}</span>}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Heads up: if a truck runs out of space, the lighter loads are dropped first so the heaviest deliveries always go out. Set a delivery&apos;s priority on the Deliveries page to override this.
                </p>
              </div>
            )}

            {/* Step 3 — vehicles + assignment */}
            {step === 2 && (
              <div>
                <p className="mb-3 text-sm text-slate-500">
                  Choose the trucks for today. For each one, say which depot it leaves from.
                </p>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {vehicles.data?.map((v) => {
                    const on = vehicleIds.has(v.id);
                    return (
                      <div key={v.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${on ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(vehicleIds, v.id, setVehicleIds)} />
                        <span className="flex-1 text-sm text-slate-700">
                          {v.name} <span className="text-xs text-slate-400">({formatWeight(v.capacity_kg)})</span>
                        </span>
                        {on && (
                          selectedDepots.length <= 1 ? (
                            <span className="text-xs text-slate-400">from {selectedDepots[0]?.name ?? '—'}</span>
                          ) : (
                            <select
                              className="input max-w-[180px] py-1 text-xs"
                              value={vehicleDepot[v.id] ?? ''}
                              onChange={(e) => setVehicleDepot((p) => ({ ...p, [v.id]: e.target.value }))}
                            >
                              {selectedDepots.map((d) => <option key={d.id} value={d.id}>from {d.name}</option>)}
                            </select>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                {vehicleIds.size > 0 && !stepValid[2] && (
                  <p className="mt-2 text-xs text-amber-600">Every selected truck needs a depot from your chosen list.</p>
                )}
              </div>
            )}

            {/* Step 4 — objective */}
            {step === 3 && (
              <div>
                <p className="mb-3 text-sm text-slate-500">We&apos;ll find the best plan for whichever you pick.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {([
                    { key: 'distance' as Objective, label: 'Shortest distance', help: 'Fewest kilometres driven. Best for saving fuel.' },
                    { key: 'time' as Objective, label: 'Fastest time', help: 'Least time on the road. Best for tight schedules.' },
                  ]).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => setObjective(o.key)}
                      className={`rounded-lg border p-4 text-left transition ${
                        objective === o.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{o.help}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Ready:</span>{' '}
                  {selectedVehicles.length} truck{selectedVehicles.length === 1 ? '' : 's'} from {selectedDepots.length} depot{selectedDepots.length === 1 ? '' : 's'},{' '}
                  {deliveryIds.size} stop{deliveryIds.size === 1 ? '' : 's'}.
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!stepValid[step]}>
                  Next
                </button>
              ) : (
                <button className="btn-primary" onClick={runOptimization} disabled={!canRun || optimize.isPending}>
                  {optimize.isPending ? 'Building the plan…' : result ? 'Update the plan' : 'Show me the plan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="mx-auto mt-8 max-w-5xl">
        {optimize.isPending && <Spinner label="Building the distance matrix and solving…" />}
        {optimize.error && <ErrorState message={apiError(optimize.error)} />}

        {result && !optimize.isPending && (
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-3 text-sm">
                <span className="badge bg-brand-50 capitalize text-brand-700">
                  {result.job.objective === 'distance' ? 'Shortest distance' : 'Fastest time'}
                </span>
                <span><span className="text-slate-400">Trucks</span> <b>{result.job.vehicle_count}</b></span>
                <span><span className="text-slate-400">Stops</span> <b>{result.job.stop_count}</b></span>
                <span><span className="text-slate-400">Distance</span> <b>{formatDistance(result.job.total_distance)}</b></span>
                <span><span className="text-slate-400">Time</span> <b>{formatDuration(result.job.total_time)}</b></span>
                <button
                  className="ml-auto text-brand-600 hover:underline"
                  onClick={() => downloadCsv(`route-${result.job.id.slice(0, 8)}.csv`, buildRouteCsv(result, depots.data ?? []))}
                >
                  Export CSV
                </button>
                <Link href={`/map?job=${result.job.id}`} className="text-brand-600 hover:underline">View on map →</Link>
              </div>

              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Truck</th>
                    <th className="px-3 py-2 font-medium">Stops</th>
                    <th className="px-3 py-2 font-medium">Distance</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Utilization</th>
                    <th className="px-5 py-2 font-medium">Driver sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.results.map((r) => {
                    const dep = depotFor(r);
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                            {r.vehicle_name}
                          </div>
                          <div className="mt-0.5 max-w-[280px] truncate text-xs text-slate-400" title={r.stop_sequence.map((s) => s.customer_name).join(' → ')}>
                            {dep?.name ?? 'Depot'} → {r.stop_sequence.map((s) => s.customer_name).join(' → ')} → {dep?.name ?? 'Depot'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{r.stop_sequence.length}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDistance(r.total_distance)}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDuration(r.total_time)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.utilization_pct)}%`, background: r.color }} />
                            </div>
                            <span className="text-xs text-slate-500">{r.utilization_pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 text-xs">
                            <button className="text-brand-600 hover:underline" onClick={() => buildVehiclePdf(r, dep, addrById)}>PDF</button>
                            <button className="text-brand-600 hover:underline" onClick={() => buildVehicleXlsx(r, dep, addrById)}>Excel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <SavingsPanel job={result.job} />
          </div>
        )}
      </div>
    </div>
  );
}
