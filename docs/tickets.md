# Work tickets

Hand-off tasks scoped to be worked independently. Branch per ticket, open a PR,
let CI pass, review + merge. Coordinate only on the shared files flagged below.

---

## Ticket 1 — Upload "usual routes" (CSV) to compare against optimized

**Context**
Today the "usual route" in the comparison is *mocked* — the backend builds it
from deliveries in entered order (`analysis.baseline.source = 'mock'`, see
`backend/src/services/routeService.ts`). We want users to upload their *actual*
current route so the savings reflect reality. The seam already exists:
`BaselineRoute.source` is `'mock' | 'uploaded'`, and the map + `SavingsPanel`
already render `analysis.baseline`.

**Scope / tasks**
- **Backend:** add `POST /api/routes/:id/baseline` accepting a CSV of the usual
  route (ordered stops). Parse it (reuse patterns in `csvService.ts`), match rows
  to the job's deliveries (by `delivery_id`, or name/coords), compute distance +
  time from the **same matrix logic** so it's comparable, fetch road geometry
  (`directionsService.roadGeometry`), and store as `analysis.baseline` with
  `source: 'uploaded'`. Recompute `analysis.usual` totals from the uploaded route.
- **Frontend:** an "Upload usual route" action on the Map page (file input →
  `POST` → refetch). The legend already drops "(estimated)" when
  `source !== 'mock'`.
- Define + document the upload CSV format (e.g. `sequence,delivery_id` or
  `sequence,customer_name,latitude,longitude`).

**Acceptance criteria**
- Can upload a usual-route CSV for a completed job; map overlay + `SavingsPanel`
  update to the uploaded route.
- Savings recompute vs the uploaded route; legend shows "Usual" (no "estimated").
- Invalid/mismatched CSV → friendly per-row errors (like the delivery importer).

**Files:** `routeController.ts`, `routeService.ts`, `csvService.ts`,
`routeRepository.ts`, `CONTRACT.md`, frontend `lib/api.ts`, `app/map/page.tsx`.
**⚠ Coordinate:** touches `CONTRACT.md` + the `types` mirrors (shared). Do the
contract/type addition as a **small first PR**, then build on it.

---

## Ticket 2 — Per-driver route sheets (PDF / Excel)

**Context**
We already export a combined CSV of all vehicles
(`frontend/src/lib/export.ts` → `buildRouteCsv`). Drivers need a clean, printable
**per-vehicle** sheet: depart depot → ordered stops → return.

**Scope / tasks**
- Add per-driver export to `lib/export.ts`: filter to one vehicle, produce **PDF**
  (e.g. `jspdf` + `jspdf-autotable`, or a print-friendly HTML view) and **Excel**
  (`xlsx`/SheetJS, or per-vehicle CSV).
- Sheet contents: vehicle name, depot, then a numbered table of stops (sequence,
  customer, address, weight), plus totals (distance, time, utilization %).
- UI: a "Driver sheet" download control per vehicle on the Optimize results table
  and the Map summary.

**Acceptance criteria**
- One PDF and one Excel per vehicle, with ordered stops + totals, open correctly
  in Acrobat/Excel.
- Reachable from both Optimize and Map.

**Files:** `frontend/src/lib/export.ts` (extend), a new component,
`frontend/package.json` (new dep).
**⚠ Coordinate:** adding a dependency edits `package.json` — give this ticket sole
ownership of that file for its PR to avoid conflicts. Low risk otherwise.

---

### Workflow reminder
- Branch names: `feature/upload-usual-route`, `feature/driver-sheets`.
- Keep PRs small; rebase on `main` before pushing.
- Agree on `CONTRACT.md` changes before coding (it's the shared API spec).
- New DB schema changes → add a new numbered migration file, never edit an applied one.
