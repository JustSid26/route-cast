'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { Vehicle, VehicleInput } from '@/lib/types';
import { formatWeight } from '@/lib/format';
import { PageHeader, Spinner, ErrorState, EmptyState, Modal, Field, ConfirmDialog } from '@/components/ui';

const EMPTY: VehicleInput = {
  name: '', registration_number: '', capacity_kg: 1000,
  max_height_m: 2.5, max_weight_kg: 1000, avg_speed_kmh: 40, active: true,
};

export default function VehiclesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['vehicles'], queryFn: api.listVehicles });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vehicles'] });

  const save = useMutation({
    mutationFn: (input: VehicleInput) =>
      editing ? api.updateVehicle(editing.id, input) : api.createVehicle(input),
    onSuccess: () => { invalidate(); setOpen(false); },
    onError: (e) => setFormError(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => { invalidate(); setPendingDelete(null); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setFormError(null); setOpen(true); }
  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      name: v.name, registration_number: v.registration_number, capacity_kg: v.capacity_kg,
      max_height_m: v.max_height_m, max_weight_kg: v.max_weight_kg,
      avg_speed_kmh: v.avg_speed_kmh, active: v.active,
    });
    setFormError(null); setOpen(true);
  }

  const num = (k: keyof VehicleInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Number(e.target.value) });

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet available for route optimization"
        action={<button className="btn-primary" onClick={openCreate}>+ Add Vehicle</button>}
      />

      {isLoading && <Spinner />}
      {error && <ErrorState message={apiError(error)} />}
      {data && data.length === 0 && <EmptyState title="No vehicles yet" hint="Add a vehicle to enable optimization." />}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Reg. No.</th>
                <th className="px-5 py-3">Capacity</th>
                <th className="px-5 py-3">Max Height</th>
                <th className="px-5 py-3">Avg Speed</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{v.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{v.registration_number || '—'}</td>
                  <td className="px-5 py-3">{formatWeight(v.capacity_kg)}</td>
                  <td className="px-5 py-3">{v.max_height_m} m</td>
                  <td className="px-5 py-3">{v.avg_speed_kmh} km/h</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="mr-3 text-brand-600 hover:underline" onClick={() => openEdit(v)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={() => setPendingDelete(v)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          {formError && <ErrorState message={formError} />}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vehicle Name">
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Registration Number">
              <input className="input" value={form.registration_number}
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
            </Field>
            <Field label="Capacity (kg)">
              <input className="input" type="number" step="any" min="1" required value={form.capacity_kg} onChange={num('capacity_kg')} />
            </Field>
            <Field label="Max Weight (kg)">
              <input className="input" type="number" step="any" min="0" value={form.max_weight_kg} onChange={num('max_weight_kg')} />
            </Field>
            <Field label="Max Height (m)">
              <input className="input" type="number" step="any" min="0" value={form.max_height_m} onChange={num('max_height_m')} />
            </Field>
            <Field label="Average Speed (km/h)">
              <input className="input" type="number" step="any" min="1" value={form.avg_speed_kmh} onChange={num('avg_speed_kmh')} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active (available for optimization)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete vehicle?"
        message={`"${pendingDelete?.name}" will be permanently removed. This cannot be undone.`}
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}
