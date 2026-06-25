'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { GeoResult, Objective, RouteJobDetail } from '@/lib/types';
import { formatDistance, formatDuration, formatWeight } from '@/lib/format';
import { deliveriesForHub } from '@/lib/geo';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';
import { AddressSearch } from '@/components/AddressSearch';

const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => <Spinner label="Loading map…" />,
});

const km = (m: number) => (m / 1000).toFixed(1);

export default function PlannerPage() {
  const qc = useQueryClient();
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.listVehicles });
  const deliveries = useQuery({ queryKey: ['deliveries'], queryFn: api.listDeliveries });

  const [depotId, setDepotId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [objective, setObjective] = useState<Objective>('distance');
  const [stopIds, setStopIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [result, setResult] = useState<RouteJobDetail | null>(null);

  // Add-a-stop sub-form (ad-hoc geocoded address → new client).
  const [picked, setPicked] = useState<GeoResult | null>(null);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => { if (depots.data?.length && !depotId) setDepotId(depots.data[0].id); }, [depots.data, depotId]);
  useEffect(() => {
    const active = vehicles.data?.filter((v) => v.active) ?? [];
    if (active.length && !truckId) setTruckId(active[0].id);
  }, [vehicles.data, truckId]);

  const depot = depots.data?.find((d) => d.id === depotId) ?? null;
  const truck = vehicles.data?.find((v) => v.id === truckId) ?? null;
  const stopList = showAll
    ? (deliveries.data ?? [])
    : deliveriesForHub(deliveries.data ?? [], depots.data ?? [], depotId);

  function toggleStop(id: string) {
    setStopIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const addStop = useMutation({
    mutationFn: () => api.createDelivery({
      customer_name: newName.trim() || picked!.label,
      address: picked!.label,
      latitude: Number(picked!.latitude.toFixed(6)),
      longitude: Number(picked!.longitude.toFixed(6)),
      weight: Number(newWeight) || 0,
      volume: 0,
      priority: 3,
    }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      setStopIds((prev) => new Set(prev).add(d.id));
      setPicked(null); setNewName(''); setNewWeight(''); setShowAll(true);
    },
  });

  const optimize = useMutation({
    mutationFn: () => api.optimize({
      depot_id: depotId, objective, vehicle_ids: [truckId],
      delivery_ids: [...stopIds], ignore_capacity: true,
    }),
    onSuccess: setResult,
  });

  const route = result?.results[0] ?? null;
  const legSum = useMemo(
    () => route?.stop_sequence.reduce((s, st) => s + (st.leg_distance ?? 0), 0) ?? 0,
    [route]
  );
  const returnLeg = route ? Math.max(0, route.total_distance - legSum) : 0;
  const overCapacity = !!(route && truck && route.load_kg > truck.capacity_kg);
  const ready = depotId && truckId && stopIds.size > 0;

  return (
    <div>
      <PageHeader title="Trip Planner" subtitle="Build one truck's multi-stop run — we compute the best order" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Builder */}
        <div className="space-y-5 lg:col-span-1">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">1 · Warehouse</h3>
            <select className="input" value={depotId} onChange={(e) => { setDepotId(e.target.value); setStopIds(new Set()); }}>
              {depots.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">2 · Truck</h3>
            <select className="input" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
              {vehicles.data?.filter((v) => v.active).map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {formatWeight(v.capacity_kg)}</option>
              ))}
            </select>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">3 · Stops ({stopIds.size})</h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                show all clients
              </label>
            </div>
            <div className="max-h-52 space-y-1 overflow-auto">
              {stopList.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={stopIds.has(d.id)} onChange={() => toggleStop(d.id)} />
                  {d.customer_name} <span className="text-xs text-slate-400">({formatWeight(d.weight)})</span>
                </label>
              ))}
              {stopList.length === 0 && <p className="text-xs text-slate-400">No clients near this hub — toggle “show all”.</p>}
            </div>

            {/* Add a new address as a stop */}
            <div className="mt-3">
              <AddressSearch onSelect={setPicked} focus={depot ? { latitude: depot.latitude, longitude: depot.longitude } : undefined} focusLabel={depot?.name} />
              {picked && (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-2">
                  <div className="truncate text-xs text-slate-500">{picked.label}</div>
                  <div className="flex gap-2">
                    <input className="input" placeholder="Client name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <input className="input max-w-[6rem]" placeholder="kg" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                  </div>
                  <button className="btn-secondary w-full" disabled={addStop.isPending} onClick={() => addStop.mutate()}>
                    {addStop.isPending ? 'Adding…' : 'Add stop'}
                  </button>
                  {addStop.error && <p className="text-xs text-red-600">{apiError(addStop.error)}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">4 · Objective</h3>
            <div className="flex gap-2">
              {(['distance', 'time'] as Objective[]).map((o) => (
                <button key={o}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${objective === o ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}
                  onClick={() => setObjective(o)}>Minimize {o}</button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={!ready || optimize.isPending} onClick={() => optimize.mutate()}>
            {optimize.isPending ? 'Optimizing…' : 'Optimize route'}
          </button>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          {optimize.isPending && <Spinner label="Finding the best order…" />}
          {optimize.error && <ErrorState message={apiError(optimize.error)} />}
          {!result && !optimize.isPending && (
            <div className="card flex h-full items-center justify-center py-20 text-center text-sm text-slate-400">
              Pick a warehouse, a truck and some stops, then optimize.
            </div>
          )}

          {route && (
            <div className="space-y-4">
              <div className="card flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm">
                <span className="font-semibold text-slate-800">{route.vehicle_name}</span>
                <span><span className="text-slate-400">Stops</span> <b>{route.stop_sequence.length}</b></span>
                <span><span className="text-slate-400">Distance</span> <b>{formatDistance(route.total_distance)}</b></span>
                <span><span className="text-slate-400">Time</span> <b>{formatDuration(route.total_time)}</b></span>
                <span className={overCapacity ? 'text-rose-600' : 'text-slate-600'}>
                  <span className="text-slate-400">Load</span> <b>{formatWeight(route.load_kg)}</b>
                  {truck && <> / {formatWeight(truck.capacity_kg)} ({route.utilization_pct}%)</>}
                </span>
                {overCapacity && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                    Over capacity — needs another trip/truck
                  </span>
                )}
                <Link href={`/map?job=${result!.job.id}`} className="ml-auto text-brand-600 hover:underline">View on map →</Link>
              </div>

              <div className="card overflow-hidden p-0">
                <RouteMap depots={depot ? [depot] : []} results={result!.results} />
              </div>

              {/* Ordered stop list with per-leg distance */}
              <div className="card overflow-hidden">
                <ol className="divide-y divide-slate-100 text-sm">
                  <li className="flex items-center justify-between px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="grid h-6 w-6 place-items-center rounded bg-slate-800 text-xs font-bold text-white">H</span>
                      Depart · {depot?.name ?? 'Warehouse'}
                    </span>
                  </li>
                  {route.stop_sequence.map((s) => (
                    <li key={s.delivery_id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: route.color }}>{s.sequence}</span>
                        {s.customer_name} <span className="text-xs text-slate-400">({formatWeight(s.weight)})</span>
                      </span>
                      <span className="text-xs text-slate-500">{s.leg_distance != null ? `${km(s.leg_distance)} km` : ''}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between px-4 py-2.5 text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded bg-slate-300 text-xs font-bold text-white">H</span>
                      Return · {depot?.name ?? 'Warehouse'}
                    </span>
                    <span className="text-xs">{km(returnLeg)} km</span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
