'use client';

import { useState } from 'react';
import { api, apiError } from '@/lib/api';
import { GeoResult } from '@/lib/types';

/**
 * Address search box. Type a place name, pick a result, and the parent form
 * receives the matched label + coordinates to auto-fill its fields.
 */
export function AddressSearch({
  onSelect,
  focus,
  focusLabel,
}: {
  onSelect: (r: GeoResult) => void;
  /** Bias results toward this point (e.g. the selected hub). */
  focus?: { latitude: number; longitude: number };
  /** Name of the focus area, shown as a hint. */
  focusLabel?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function search() {
    if (q.trim().length < 3) {
      setError('Type at least 3 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.geocode(q.trim(), focus);
      setResults(res);
      setOpen(true);
      if (res.length === 0) setError('No matches found');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <span className="label">
        Search address (auto-fills coordinates)
        {focusLabel ? ` · near ${focusLabel}` : ''}
      </span>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="e.g. Powai, Mumbai"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
        />
        <button type="button" className="btn-secondary whitespace-nowrap" onClick={search} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {open && results.length > 0 && (
        <ul className="mt-2 max-h-44 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                  setQ(r.label);
                }}
              >
                <span className="text-slate-700">{r.label}</span>
                <span className="font-mono text-xs text-slate-400">
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
