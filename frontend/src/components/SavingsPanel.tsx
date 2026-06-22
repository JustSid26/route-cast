'use client';

import { useState } from 'react';
import { RouteJob, RouteAnalysis } from '@/lib/types';
import { formatDistance, formatDuration } from '@/lib/format';

function hasAnalysis(job: RouteJob): job is RouteJob & { analysis: RouteAnalysis } {
  return !!job.analysis && 'usual' in job.analysis && (job.analysis as RouteAnalysis).stops > 0;
}

const km = (m: number) => m / 1000;
const hrs = (s: number) => s / 3600;

export function SavingsPanel({ job }: { job: RouteJob }) {
  // Editable assumptions — the calculation is fully transparent and tweakable.
  const [fuelEconomy, setFuelEconomy] = useState(5); // km per litre
  const [fuelPrice, setFuelPrice] = useState(100); // currency per litre
  const [driverCost, setDriverCost] = useState(200); // currency per hour
  const currency = '₹';

  if (!hasAnalysis(job)) return null;
  const a = job.analysis;

  const money = (x: number) => `${currency}${Math.round(x).toLocaleString('en-IN')}`;

  // Savings vs. the "usual" (entered-order, single-vehicle) route.
  const distSavedM = a.usual.distance - a.optimized.distance;
  const timeSavedS = a.usual.time - a.optimized.time;
  const distSavedKm = km(distSavedM);
  const fuelSavedL = distSavedKm / fuelEconomy;
  const fuelCostSaved = fuelSavedL * fuelPrice;
  const timeSavedHr = hrs(timeSavedS);
  const driverCostSaved = timeSavedHr * driverCost;
  const totalMoney = fuelCostSaved + driverCostSaved;
  const pctDist = a.usual.distance > 0 ? (distSavedM / a.usual.distance) * 100 : 0;

  const scenarios = [
    { key: 'worst', label: 'Worst case', hint: 'one trip per stop', tone: 'bg-red-500', m: a.worst },
    { key: 'average', label: 'Average', hint: 'random / no planning', tone: 'bg-amber-500', m: a.average },
    { key: 'usual', label: 'Usual route', hint: 'manual, entered order', tone: 'bg-slate-400', m: a.usual },
    { key: 'optimized', label: 'Optimized', hint: 'OR-Tools plan', tone: 'bg-emerald-500', m: a.optimized },
  ];
  const maxDist = Math.max(...scenarios.map((s) => s.m.distance), 1);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Savings vs. usual route</h3>
        <p className="text-xs text-slate-400">All scenarios measured on the same road matrix — fleet totals.</p>
      </div>

      {/* Headline savings */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        <Stat label="Distance saved" value={`${distSavedKm.toFixed(1)} km`} sub={`${pctDist.toFixed(0)}% less`} />
        <Stat label="Time saved" value={formatDuration(timeSavedS)} sub="driver-hours" />
        <Stat label="Fuel saved" value={`${fuelSavedL.toFixed(1)} L`} sub={`${fuelEconomy} km/L`} />
        <Stat label="Money saved" value={money(totalMoney)} sub="per run" highlight />
      </div>

      {/* Scenario comparison bars */}
      <div className="space-y-2.5 px-5 py-4">
        {scenarios.map((s) => (
          <div key={s.key} className="flex items-center gap-3 text-sm">
            <div className="w-28 shrink-0">
              <div className="font-medium text-slate-700">{s.label}</div>
              <div className="text-[11px] text-slate-400">{s.hint}</div>
            </div>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className={`flex h-full items-center justify-end rounded px-2 text-[11px] font-medium text-white ${s.tone}`}
                style={{ width: `${Math.max(8, (s.m.distance / maxDist) * 100)}%` }}
              >
                {km(s.m.distance).toFixed(0)} km
              </div>
            </div>
            <div className="w-16 shrink-0 text-right text-xs text-slate-500">{formatDuration(s.m.time)}</div>
          </div>
        ))}
      </div>

      {/* Transparent calculation + editable assumptions */}
      <details className="border-t border-slate-100 px-5 py-3" open>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">How it's calculated</summary>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Assumption label="Fuel economy (km/L)" value={fuelEconomy} onChange={setFuelEconomy} step={0.5} />
          <Assumption label={`Fuel price (${currency}/L)`} value={fuelPrice} onChange={setFuelPrice} step={1} />
          <Assumption label={`Driver cost (${currency}/h)`} value={driverCost} onChange={setDriverCost} step={10} />
        </div>

        <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
          <Calc>
            Distance saved = {formatDistance(a.usual.distance)} (usual) − {formatDistance(a.optimized.distance)} (optimized) ={' '}
            <b className="text-slate-900">{distSavedKm.toFixed(1)} km</b>
          </Calc>
          <Calc>
            Fuel saved = {distSavedKm.toFixed(1)} km ÷ {fuelEconomy} km/L ={' '}
            <b className="text-slate-900">{fuelSavedL.toFixed(1)} L</b>
          </Calc>
          <Calc>
            Fuel cost saved = {fuelSavedL.toFixed(1)} L × {money(fuelPrice)}/L ={' '}
            <b className="text-slate-900">{money(fuelCostSaved)}</b>
          </Calc>
          <Calc>
            Driver time saved = {timeSavedHr.toFixed(2)} h × {money(driverCost)}/h ={' '}
            <b className="text-slate-900">{money(driverCostSaved)}</b>
          </Calc>
          <Calc>
            Total saved = {money(fuelCostSaved)} + {money(driverCostSaved)} ={' '}
            <b className="text-emerald-700">{money(totalMoney)}</b> per run
          </Calc>
        </div>
        {distSavedM < 0 && (
          <p className="mt-2 text-xs text-amber-600">
            Note: with these stops the optimized fleet total is close to the usual route; the bigger win here is
            parallel delivery across vehicles (shorter completion time).
          </p>
        )}
      </details>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white px-4 py-3 ${highlight ? 'bg-emerald-50' : ''}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Assumption({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </label>
  );
}

function Calc({ children }: { children: React.ReactNode }) {
  return <div className="leading-relaxed">{children}</div>;
}
