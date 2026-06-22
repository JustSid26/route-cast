'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { Depot, DepotInput } from '@/lib/types';
import { PageHeader, Spinner, ErrorState, EmptyState, Modal, Field, ConfirmDialog } from '@/components/ui';
import { AddressSearch } from '@/components/AddressSearch';

const EMPTY: DepotInput = { name: '', address: '', latitude: 0, longitude: 0 };

export default function DepotsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Depot | null>(null);
  const [form, setForm] = useState<DepotInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Depot | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['depots'] });

  const save = useMutation({
    mutationFn: (input: DepotInput) =>
      editing ? api.updateDepot(editing.id, input) : api.createDepot(input),
    onSuccess: () => { invalidate(); setOpen(false); },
    onError: (e) => setFormError(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDepot(id),
    onSuccess: () => { invalidate(); setPendingDelete(null); },
  });

  function openCreate() {
    setEditing(null); setForm(EMPTY); setFormError(null); setOpen(true);
  }
  function openEdit(d: Depot) {
    setEditing(d);
    setForm({ name: d.name, address: d.address, latitude: d.latitude, longitude: d.longitude });
    setFormError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Depots"
        subtitle="Origin points for vehicle routes"
        action={<button className="btn-primary" onClick={openCreate}>+ Add Depot</button>}
      />

      {isLoading && <Spinner />}
      {error && <ErrorState message={apiError(error)} />}
      {data && data.length === 0 && <EmptyState title="No depots yet" hint="Add a depot to get started." />}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Coordinates</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-5 py-3 text-slate-500">{d.address || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="mr-3 text-brand-600 hover:underline" onClick={() => openEdit(d)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={() => setPendingDelete(d)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Depot' : 'Add Depot'}>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
        >
          {formError && <ErrorState message={formError} />}
          <AddressSearch
            onSelect={(r) =>
              setForm((f) => ({
                ...f,
                address: r.label,
                latitude: Number(r.latitude.toFixed(6)),
                longitude: Number(r.longitude.toFixed(6)),
              }))
            }
          />
          <Field label="Name">
            <input className="input" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Address">
            <input className="input" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude">
              <input className="input" type="number" step="any" required value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} />
            </Field>
            <Field label="Longitude">
              <input className="input" type="number" step="any" required value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} />
            </Field>
          </div>
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
        title="Delete depot?"
        message={`"${pendingDelete?.name}" will be permanently removed. This cannot be undone.`}
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}
