# RouteDemand — Vehicle Routing Platform (MVP)

A production-quality MVP of a route-optimization platform (a simplified Locus /
FarEye / Shipsy). A logistics manager uploads delivery stops and vehicles, and the
system generates **capacity-aware optimized routes** and renders them on a map.

> Scope is deliberately limited to **route optimization**. No forecasting, tracking,
> invoicing, CRM, WMS, auth providers, billing, or chat.

---

## Architecture

```
┌──────────────┐     REST/JSON      ┌────────────────┐     SQL      ┌──────────────────┐
│  Frontend    │ ─────────────────▶ │  Node.js API   │ ───────────▶ │ PostgreSQL +     │
│ Next.js + TS │                    │ Express + TS   │              │ PostGIS          │
│ Leaflet      │ ◀───────────────── │ (clean arch.)  │ ◀─────────── │                  │
└──────────────┘                    └───────┬────────┘              └──────────────────┘
                                            │  ├── OpenRouteService Matrix API (optional)
                                            │  └── Haversine fallback (no key needed)
                                            ▼
                                    ┌────────────────┐
                                    │ Optimization   │  Python + Google OR-Tools
                                    │ service (CVRP) │  (FastAPI, /solve)
                                    └────────────────┘
```

The backend follows **controllers → services → repositories** with a shared
domain-type layer; constraints and providers are pluggable (see
[Extending](#extending-the-optimizer)).

| Service | Stack | Port |
|---|---|---|
| `frontend` | Next.js 14, TypeScript, Tailwind, React Query, Leaflet | 3000 |
| `backend` | Node.js, Express, TypeScript, `pg`, Zod | 4000 |
| `optimization-service` | Python, FastAPI, Google OR-Tools | 8000 |
| `postgres` | PostgreSQL 16 + PostGIS 3.4 | 5432 |

---

## Quick start (Docker)

```bash
cp .env.example .env          # optionally add an ORS_API_KEY
docker compose up --build
```

Then open:

- **Frontend** → http://localhost:3000
- **Backend health** → http://localhost:4000/health
- **Optimizer health** → http://localhost:8000/health

The database is created, migrated, and **seeded** automatically on first start
(1 depot, 3 vehicles, 12 deliveries around Bengaluru). Go to **Optimize → Run
Optimization** and then **Route Map** to see results immediately.

> **OpenRouteService is optional.** With no `ORS_API_KEY`, the backend computes a
> Haversine distance/time matrix so everything works fully offline. Add a free key
> (https://openrouteservice.org) to use real road distances.

---

## Local development (without Docker)

Requires Node 20+, Python 3.12+, and a local PostgreSQL with PostGIS.

```bash
# 1. Database
createdb vrp
psql vrp -f db/migrations/001_init.sql
psql vrp -f db/seed.sql

# 2. Optimization service
cd optimization-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# 3. Backend
cd backend
npm install
DATABASE_URL=postgresql://localhost:5432/vrp \
  OPTIMIZATION_SERVICE_URL=http://localhost:8000 npm run dev
# (or `npm run migrate -- --seed` to apply migrations + seed against DATABASE_URL)

# 4. Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:4000/api npm run dev
```

---

## Features

- **Depots** — create / edit / delete (name, address, lat/lng).
- **Vehicles** — name, registration, capacity, max height/weight, average speed, active flag.
- **Deliveries** — full CRUD plus **CSV upload** with per-row validation and an import preview.
- **Optimization** — multi-vehicle CVRP via OR-Tools, capacity constraints, and a
  distance- or time-minimization objective. Over-subscribed stops are dropped
  gracefully rather than failing the whole job.
- **Map** — Leaflet + OpenStreetMap tiles; depot marker, sequenced delivery markers,
  per-vehicle colored polylines, and a route summary.
- **Dashboard** — totals for deliveries, vehicles, depots, optimized routes,
  distance, and travel time.

### CSV format

```
customer_name,address,latitude,longitude,weight,volume,priority
```

A ready-to-use sample lives at [`sample-data/deliveries.csv`](sample-data/deliveries.csv).

---

## API

Base URL `http://localhost:4000/api`. Full contract in [`CONTRACT.md`](CONTRACT.md).

| Resource | Endpoints |
|---|---|
| Depots | `GET/POST /depots`, `GET/PUT/DELETE /depots/:id` |
| Vehicles | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id` |
| Deliveries | `GET/POST /deliveries`, `GET/PUT/DELETE /deliveries/:id`, `POST /deliveries/validate`, `POST /deliveries/import` |
| Routes | `GET /routes`, `GET /routes/:id`, `DELETE /routes/:id` |
| Optimize | `POST /optimize` |
| Dashboard | `GET /dashboard` |

Distances are returned in **meters** and times in **seconds**; the UI formats them.

---

## Database

Schema lives in [`db/migrations/001_init.sql`](db/migrations/001_init.sql):
`depots`, `vehicles`, `deliveries`, `route_jobs`, `route_results`. Depots and
deliveries carry a generated PostGIS `geography(Point)` column with GIST indexes for
future spatial queries.

---

## Extending the optimizer

The design anticipates richer constraints:

- **Time windows** — add `time_window` columns to `deliveries`, pass them to
  `/solve`, and register a `Time` dimension with `CumulVar` ranges in `solver.py`.
- **Vehicle restrictions** (height/weight, zones) — filter eligible vehicles in
  `routeService.optimize`, or model with per-vehicle allowed-node callbacks.

Each lives behind a clear seam: matrix building (`matrixService`), solving
(`optimizationService` → Python `solver`), and orchestration (`routeService`).

---

## Tests

```bash
cd backend && npm test                      # CSV parsing/validation unit tests
cd optimization-service && python test_solver.py   # CVRP solver smoke tests
```

---

## Known limitations (MVP)

- Optimization runs **synchronously** within the request. The `route_jobs` /
  `route_results` tables are structured so this can move to a queue/worker later.
- Map polylines follow real roads via the ORS **Directions** API when an
  `ORS_API_KEY` is set; without a key they fall back to straight stop-to-stop
  segments (same as the Haversine matrix fallback).
- No authentication — out of scope for this MVP.
