'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { formatDistance, formatDuration } from '@/lib/format';
import { PageHeader, Spinner, ErrorState, EmptyState } from '@/components/ui';
import { SavingsPanel } from '@/components/SavingsPanel';

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

  return (
    <div>
      <PageHeader
        title="Route Map"
        subtitle="Visualize optimized vehicle routes"
        action={
          <select className="input max-w-xs" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Select a route job…</option>
            {jobs.data?.filter((j) => j.status === 'completed').map((j) => (
              <option key={j.id} value={j.id}>
                {j.id.slice(0, 8)} · {j.vehicle_count} vehicles · {formatDistance(j.total_distance)}
              </option>
            ))}
          </select>
        }
      />

      {jobs.data && jobs.data.length === 0 && (
        <EmptyState title="No routes to display" hint="Run an optimization first." />
      )}
      {detail.error && <ErrorState message={apiError(detail.error)} />}

      {jobId && detail.data && (
        <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="card overflow-hidden p-0">
              <RouteMap depot={depot} results={detail.data.results} />
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
