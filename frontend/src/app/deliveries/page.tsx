'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '@/lib/api';
import { Delivery, DeliveryInput, CsvValidation } from '@/lib/types';
import { formatWeight, priorityLabel } from '@/lib/format';
import { deliveriesForHub } from '@/lib/geo';
import { PageHeader, Spinner, ErrorState, EmptyState, Modal, Field, ConfirmDialog } from '@/components/ui';
import { AddressSearch } from '@/components/AddressSearch';

const EMPTY: DeliveryInput = {
  customer_name: '', address: '', latitude: 0, longitude: 0,
  weight: 0, volume: 0, priority: 3,
};

export default function DeliveriesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['deliveries'], queryFn: api.listDeliveries });
  const depots = useQuery({ queryKey: ['depots'], queryFn: api.listDepots });

  const [hubId, setHubId] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Delivery | null>(null);
  const [form, setForm] = useState<DeliveryInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Delivery | null>(null);

  // CSV state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [validation, setValidation] = useState<CsvValidation | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); };

  const save = useMutation({
    mutationFn: (input: DeliveryInput) =>
      editing ? api.updateDelivery(editing.id, input) : api.createDelivery(input),
    onSuccess: () => { invalidate(); setOpen(false); },
    onError: (e) => setFormError(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDelivery(id),
    onSuccess: () => { invalidate(); setPendingDelete(null); },
  });

  const validate = useMutation({
    mutationFn: (csv: string) => api.validateCsv(csv),
    onSuccess: (v) => { setValidation(v); setCsvError(null); },
    onError: (e) => { setCsvError(apiError(e)); setValidation(null); },
  });
  const importCsv = useMutation({
    mutationFn: (csv: string) => api.importCsv(csv),
    onSuccess: (r) => {
      invalidate();
      setImportMsg(`Imported ${r.imported} deliveries${r.errors.length ? `, ${r.errors.length} skipped` : ''}.`);
      setValidation(null); setCsvText('');
    },
    onError: (e) => setCsvError(apiError(e)),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setFormError(null); setOpen(true); }
  function openEdit(d: Delivery) {
    setEditing(d);
    setForm({
      customer_name: d.customer_name, address: d.address, latitude: d.latitude,
      longitude: d.longitude, weight: d.weight, volume: d.volume, priority: d.priority,
    });
    setFormError(null); setOpen(true);
  }
  function openCsv() {
    setCsvOpen(true); setCsvText(''); setValidation(null); setCsvError(null); setImportMsg(null);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsvText(text);
      validate.mutate(text);
    };
    reader.readAsText(file);
  }

  const depotList = depots.data ?? [];
  const visible = data ? deliveriesForHub(data, depotList, hubId) : [];
  const focusDepot = depotList.find((d) => d.id === hubId) ?? null;

  return (
    <div>
      <PageHeader
        title="Deliveries"
        subtitle="Delivery stops to be routed"
        action={
          <div className="flex items-center gap-2">
            {depotList.length > 0 && (
              <select
                className="input w-48"
                value={hubId}
                onChange={(e) => setHubId(e.target.value)}
                title="Filter by nearest hub"
              >
                <option value="">All hubs</option>
                {depotList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <button className="btn-secondary" onClick={openCsv}>Import CSV</button>
            <button className="btn-primary" onClick={openCreate}>+ Add Delivery</button>
          </div>
        }
      />

      {isLoading && <Spinner />}
      {error && <ErrorState message={apiError(error)} />}
      {data && data.length === 0 && <EmptyState title="No deliveries yet" hint="Add stops manually or import a CSV." />}
      {data && data.length > 0 && visible.length === 0 && (
        <EmptyState title="No deliveries near this hub" hint="Switch to “All hubs” or add stops in this area." />
      )}

      {visible.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Coordinates</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{d.customer_name}</td>
                  <td className="px-5 py-3 text-slate-500">{d.address || '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  </td>
                  <td className="px-5 py-3">{formatWeight(d.weight)}</td>
                  <td className="px-5 py-3 text-slate-600">{priorityLabel(d.priority)}</td>
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

      {/* Create / edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Delivery' : 'Add Delivery'}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          {formError && <ErrorState message={formError} />}
          <AddressSearch
            focus={focusDepot ? { latitude: focusDepot.latitude, longitude: focusDepot.longitude } : undefined}
            focusLabel={focusDepot?.name}
            onSelect={(r) =>
              setForm((f) => ({
                ...f,
                address: r.label,
                latitude: Number(r.latitude.toFixed(6)),
                longitude: Number(r.longitude.toFixed(6)),
              }))
            }
          />
          <Field label="Customer Name">
            <input className="input" required value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
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
            <Field label="Weight (kg)">
              <input className="input" type="number" step="any" min="0" value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
            </Field>
            <Field label="Volume (m³)">
              <input className="input" type="number" step="any" min="0" value={form.volume}
                onChange={(e) => setForm({ ...form, volume: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Priority (1 = highest .. 5 = lowest)">
            <select className="input" value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV import modal */}
      <Modal open={csvOpen} onClose={() => setCsvOpen(false)} title="Import deliveries from CSV">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Columns: <code className="rounded bg-slate-100 px-1">customer_name, address, latitude, longitude, weight, volume, priority</code>
          </p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700" />

          {validate.isPending && <Spinner label="Validating…" />}
          {csvError && <ErrorState message={csvError} />}
          {importMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMsg}</div>
          )}

          {validation && (
            <div className="rounded-lg border border-slate-200 p-4 text-sm">
              <div className="flex gap-6">
                <span>Rows: <strong>{validation.rows}</strong></span>
                <span className="text-emerald-600">Valid: <strong>{validation.valid}</strong></span>
                <span className="text-red-600">Errors: <strong>{validation.errors.length}</strong></span>
              </div>
              {validation.errors.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-red-600">
                  {validation.errors.map((e) => (
                    <li key={e.row}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setCsvOpen(false)}>Close</button>
            <button
              className="btn-primary"
              disabled={!validation || validation.valid === 0 || importCsv.isPending}
              onClick={() => importCsv.mutate(csvText)}
            >
              {importCsv.isPending ? 'Importing…' : `Import ${validation?.valid ?? 0} valid rows`}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete delivery?"
        message={`"${pendingDelete?.customer_name}" will be permanently removed. This cannot be undone.`}
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}
