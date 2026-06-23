'use client';

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { formatDistance, formatDuration } from '@/lib/format';
import { PageHeader, Spinner, ErrorState, EmptyState } from '@/components/ui';
import { SavingsPanel } from '@/components/SavingsPanel';
import { buildRouteCsv, downloadCsv, buildVehiclePdf, buildVehicleXlsx } from '@/lib/export';

// Leaflet touches `window`; load the map only on the client.
const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => <Spinner label="Loading map…" />,
});

function MapView() {
  const params = useSearchParams();
  const jobFromUrl = params.get('job');

  const jobs = useQuery({ queryKey: ['routes'], queryFn: api.listRoutes });
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });
  const deliveries = useQuery({ queryKey: ['deliveries'], queryFn: api.listDeliveries });

  // delivery_id → address, for per-driver route sheets (stops carry no address).
  const addrById = new Map((deliveries.data ?? []).map((d) => [d.id, d.address] as const));

  const [jobId, setJobId] = useState<string>('');
  useEffect(() => {
    if (jobFromUrl) setJobId(jobFromUrl);
    else if (jobs.data?.length && !jobId) {
      const firstCompleted = jobs.data.find((j) => j.status === 'completed');
      if (firstCompleted) setJobId(firstCompleted.id);
    }
  }, [jobFromUrl, jobs.data, jobId]);

  const detail = useQuery({
    queryKey: ['route', jobId],
    queryFn: () => api.getRoute(jobId),
    enabled: Boolean(jobId),
  });

  const depot = detail.data?.job.depot_id
    ? depots.data?.find((d) => d.id === detail.data!.job.depot_id) ?? null
    : null;

  const [showUsual, setShowUsual] = useState(false);
  const baseline = detail.data?.job.analysis && 'baseline' in detail.data.job.analysis
    ? detail.data.job.analysis.baseline
    : undefined;

  // Upload the manager's actual "usual route" CSV as the comparison baseline.
  const usualFileRef = useRef<HTMLInputElement>(null);
  const uploadUsual = useMutation({
    mutationFn: (csv: string) => api.uploadBaseline(jobId, csv),
    onSuccess: () => {
      detail.refetch();
      setShowUsual(true);
    },
  });

  async function onUsualFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after an error
    if (file) uploadUsual.mutate(await file.text());
  }

  function exportCsv() {
    if (!detail.data) return;
    downloadCsv(`route-${detail.data.job.id.slice(0, 8)}.csv`, buildRouteCsv(detail.data, depot));
  }

  return (
    <div>
      <PageHeader
        title="Route Map"
        subtitle="Visualize optimized vehicle routes"
        action={
          <div className="flex items-center gap-2">
            {detail.data && (
              <>
                <input
                  ref={usualFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onUsualFile}
                />
                <button
                  className="btn-secondary"
                  onClick={() => usualFileRef.current?.click()}
                  disabled={uploadUsual.isPending}
                >
                  {uploadUsual.isPending ? 'Uploading…' : 'Upload usual route'}
                </button>
                <button className="btn-secondary" onClick={exportCsv}>Export CSV</button>
              </>
            )}
            <select className="input max-w-xs" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Select a route job…</option>
              {jobs.data?.filter((j) => j.status === 'completed').map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id.slice(0, 8)} · {j.vehicle_count} vehicles · {formatDistance(j.total_distance)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {jobs.data && jobs.data.length === 0 && (
        <EmptyState title="No routes to display" hint="Run an optimization first." />
      )}
      {detail.error && <ErrorState message={apiError(detail.error)} />}
      {uploadUsual.error && (
        <div className="mb-3"><ErrorState message={apiError(uploadUsual.error)} /></div>
      )}

      {jobId && detail.data && (
        <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            {baseline && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input type="checkbox" checked={showUsual} onChange={(e) => setShowUsual(e.target.checked)} />
                  Compare with usual route
                </label>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1 w-5 rounded" style={{ background: '#e11d48' }} /> Optimized (solid)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0 w-5 border-t-2 border-dashed border-slate-700" /> Usual
                    {baseline.source === 'mock' && <span className="text-slate-400">(estimated)</span>}
                  </span>
                </div>
              </div>
            )}
            <div className="card overflow-hidden p-0">
              <RouteMap
                depot={depot}
                results={detail.data.results}
                baselineGeometry={showUsual ? baseline?.geometry : undefined}
              />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Route summary</h3>
            {detail.data.results.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                  <span className="text-sm font-semibold text-slate-800">{r.vehicle_name}</span>
                </div>
                <dl className="space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between"><dt>Stops</dt><dd>{r.stop_sequence.length}</dd></div>
                  <div className="flex justify-between"><dt>Distance</dt><dd>{formatDistance(r.total_distance)}</dd></div>
                  <div className="flex justify-between"><dt>Time</dt><dd>{formatDuration(r.total_time)}</dd></div>
                  <div className="flex justify-between"><dt>Utilization</dt><dd>{r.utilization_pct}%</dd></div>
                </dl>
                <div className="mt-3 flex gap-3 border-t border-slate-100 pt-2 text-xs">
                  <span className="text-slate-400">Driver sheet</span>
                  <button className="text-brand-600 hover:underline" onClick={() => buildVehiclePdf(r, depot, addrById)}>PDF</button>
                  <button className="text-brand-600 hover:underline" onClick={() => buildVehicleXlsx(r, depot, addrById)}>Excel</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <SavingsPanel job={detail.data.job} />
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MapView />
    </Suspense>
  );
}
