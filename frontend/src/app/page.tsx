'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, apiError } from '@/lib/api';
import { formatDistance, formatDuration } from '@/lib/format';
import { PageHeader, Spinner, ErrorState } from '@/components/ui';
import { Icons, IconKey } from '@/components/icons';

// Default assumptions for the cumulative savings roll-up (editable per-run on
// the Optimize page). Kept in sync with SavingsPanel defaults.
const FUEL_KM_PER_L = 5;
const FUEL_PRICE = 100;
const DRIVER_COST_PER_HR = 200;
const CURRENCY = '₹';

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: IconKey;
  tone: string;
}) {
  const Icon = Icons[icon];
  return (
    <div className="card-hover flex items-start justify-between p-5">
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      </div>
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
  });
  const routes = useQuery({ queryKey: ['routes'], queryFn: api.listRoutes });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of fleet, deliveries and optimized routes"
        action={
          <Link href="/optimize" className="btn-primary">
            New Optimization
          </Link>
        }
      />

      {isLoading && <Spinner />}
      {error && <ErrorState message={apiError(error)} />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Deliveries" value={data.total_deliveries} icon="delivery" tone="bg-emerald-50 text-emerald-600" />
            <StatCard label="Total Vehicles" value={data.total_vehicles} icon="vehicle" tone="bg-teal-50 text-teal-600" />
            <StatCard label="Total Depots" value={data.total_depots} icon="depot" tone="bg-violet-50 text-violet-600" />
            <StatCard label="Optimized Routes" value={data.optimized_routes} icon="optimize" tone="bg-amber-50 text-amber-600" />
            <StatCard label="Total Distance" value={formatDistance(data.total_distance)} icon="route" tone="bg-rose-50 text-rose-600" />
            <StatCard label="Est. Travel Time" value={formatDuration(data.total_time)} icon="clock" tone="bg-cyan-50 text-cyan-600" />
          </div>

          {/* Cumulative savings vs. usual routing */}
          {(() => {
            const fuelL = data.distance_saved / 1000 / FUEL_KM_PER_L;
            const money = fuelL * FUEL_PRICE + (data.time_saved / 3600) * DRIVER_COST_PER_HR;
            const fmtMoney = `${CURRENCY}${Math.round(money).toLocaleString('en-IN')}`;
            return (
              <div className="mt-6 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                <div className="flex items-center justify-between px-5 pt-4">
                  <h2 className="text-sm font-semibold text-emerald-800">
                    Savings to date · optimized vs. usual routing
                  </h2>
                  <span className="text-xs text-emerald-700/70">
                    across {data.optimized_routes} optimization{data.optimized_routes === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-emerald-100/60 sm:grid-cols-4 mt-4">
                  <div className="bg-emerald-50/40 px-5 py-4">
                    <div className="text-xs text-emerald-700/70">Time saved</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-700">{formatDuration(data.time_saved)}</div>
                    <div className="text-[11px] text-emerald-700/60">driver-hours</div>
                  </div>
                  <div className="bg-emerald-50/40 px-5 py-4">
                    <div className="text-xs text-emerald-700/70">Distance saved</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-700">{formatDistance(data.distance_saved)}</div>
                  </div>
                  <div className="bg-emerald-50/40 px-5 py-4">
                    <div className="text-xs text-emerald-700/70">Fuel saved</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-700">{fuelL.toFixed(0)} L</div>
                  </div>
                  <div className="bg-emerald-50/40 px-5 py-4">
                    <div className="text-xs text-emerald-700/70">Money saved</div>
                    <div className="mt-1 text-3xl font-bold text-emerald-700">{fmtMoney}</div>
                  </div>
                </div>
                <p className="px-5 py-3 text-xs text-emerald-700/60">
                  Assumes {FUEL_KM_PER_L} km/L · {CURRENCY}{FUEL_PRICE}/L fuel · {CURRENCY}{DRIVER_COST_PER_HR}/h driver.
                  Per-run breakdown with editable rates on the Optimize page.
                </p>
              </div>
            );
          })()}

          <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Recent optimizations</h2>
          <div className="card overflow-hidden">
            {routes.data && routes.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Vehicles</th>
                    <th className="px-5 py-3">Stops</th>
                    <th className="px-5 py-3">Distance</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.data.slice(0, 8).map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{j.id.slice(0, 8)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`badge ${
                            j.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : j.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">{j.vehicle_count}</td>
                      <td className="px-5 py-3">{j.stop_count}</td>
                      <td className="px-5 py-3">{formatDistance(j.total_distance)}</td>
                      <td className="px-5 py-3">{formatDuration(j.total_time)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/map?job=${j.id}`} className="text-brand-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No optimizations yet. Head to the Optimize page to generate routes.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
