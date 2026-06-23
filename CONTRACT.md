# API & Service Contracts

This document is the single source of truth for the data model and the contracts
between the frontend, backend, and optimization service. All services must conform
to it.

## Conventions

- All IDs are UUID v4 strings.
- Timestamps are ISO-8601 strings (`created_at`, `updated_at`).
- Coordinates: `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180].
- Distances are returned to clients in **meters**, travel time in **seconds**.
  The frontend formats km / h:m for display.
- Error responses use HTTP status codes + body: `{ "error": { "message": string, "details"?: any } }`.
- Success list responses return a bare JSON array. Single-resource responses return the object.

## Entities

### Depot
```
{ id, name, address, latitude, longitude, created_at, updated_at }
```

### Vehicle
```
{ id, name, registration_number, capacity_kg, max_height_m,
  max_weight_kg, avg_speed_kmh, active, created_at, updated_at }
```

### Delivery
```
{ id, customer_name, address, latitude, longitude,
  weight, volume, priority, created_at, updated_at }
```
- `priority`: integer 1 (highest) .. 5 (lowest). Default 3.

### RouteJob
```
{ id, depot_id, status, objective, total_distance, total_time,
  vehicle_count, stop_count, error, analysis, created_at, updated_at }
```
- `status`: `pending | running | completed | failed`
- `objective`: `distance | time`
- `analysis`: `RouteAnalysis` once completed (otherwise `{}`).

### RouteAnalysis (savings comparison, all measured on the same matrix)
```
{ stops,
  optimized: ScenarioMetric, usual: ScenarioMetric,
  average: ScenarioMetric,   worst: ScenarioMetric,
  baseline?: BaselineRoute }
```
- `ScenarioMetric`: `{ distance, time }` (meters, seconds).
- `BaselineRoute`: `{ source, stop_sequence: DeliveryStop[], geometry: [lat,lng][],
  total_distance, total_time }` — the "usual route" drawn on the map / used by
  the savings panel.
- `source`: `mock` (deliveries in entered order, tagged "(estimated)" in the UI)
  | `uploaded` (manager's actual route, supplied via `POST /routes/:id/baseline`).

### RouteResult (one per vehicle used in a job)
```
{ id, job_id, vehicle_id, vehicle_name, depot_id, color,
  stop_sequence: DeliveryStop[],   // ordered, excludes depot
  geometry: [lat, lng][],          // full polyline incl. depot endpoints
  total_distance, total_time, load_kg, utilization_pct }
```
- `depot_id`: the home depot this vehicle departs from (multi-depot jobs span several).
- `DeliveryStop`: `{ delivery_id, customer_name, latitude, longitude, weight, sequence }`

## REST API (backend, base `/api`)

| Method | Path                  | Body                          | Returns                |
|--------|-----------------------|-------------------------------|------------------------|
| GET    | /depots               | —                             | Depot[]                |
| POST   | /depots               | DepotInput                    | Depot                  |
| GET    | /depots/:id           | —                             | Depot                  |
| PUT    | /depots/:id           | DepotInput                    | Depot                  |
| DELETE | /depots/:id           | —                             | 204                    |
| GET    | /vehicles             | —                             | Vehicle[]              |
| POST   | /vehicles             | VehicleInput                  | Vehicle                |
| GET    | /vehicles/:id         | —                             | Vehicle                |
| PUT    | /vehicles/:id         | VehicleInput                  | Vehicle                |
| DELETE | /vehicles/:id         | —                             | 204                    |
| GET    | /deliveries           | —                             | Delivery[]             |
| POST   | /deliveries           | DeliveryInput                 | Delivery               |
| GET    | /deliveries/:id       | —                             | Delivery               |
| PUT    | /deliveries/:id       | DeliveryInput                 | Delivery               |
| DELETE | /deliveries/:id       | —                             | 204                    |
| POST   | /deliveries/validate  | { csv: string }               | { rows, valid, errors }|
| POST   | /deliveries/import    | { csv: string }               | { imported, errors }   |
| GET    | /routes               | —                             | RouteJob[]             |
| GET    | /routes/:id           | —                             | { job, results }       |
| DELETE | /routes/:id           | —                             | 204                    |
| POST   | /routes/:id/baseline  | { csv: string }               | { job, results }       |
| POST   | /optimize             | OptimizeInput                 | { job, results }       |
| GET    | /dashboard            | —                             | DashboardStats         |
| GET    | /geocode?q=text       | —                             | GeoResult[]            |

`GeoResult`: `{ label, latitude, longitude }` — forward-geocoding via the
OpenRouteService (Pelias) geocoder. Requires `ORS_API_KEY`; returns 400 if unset.

`OptimizeInput`:
```
{ objective?: "distance"|"time",
  // Multi-depot: which vehicle departs from which depot. Distinct depot_ids
  // here define the set of depots in play; the first is the job's primary depot.
  assignments?: { vehicle_id, depot_id }[],
  delivery_ids?: string[],    // default: all deliveries

  // Legacy single-depot form (still accepted). Expanded server-side to
  // assignments = all (chosen/active) vehicles departing depot_id.
  depot_id?: string,
  vehicle_ids?: string[] }    // default: all active vehicles
```
Provide either `assignments[]` or `depot_id`. Priority: when delivery `priority`
values differ they are honoured (1=low…5=high); when they are all equal the
solver derives importance from `weight`, so the heaviest unit is served first.
Both only affect *which* stops drop if capacity is exceeded — never the routing.

`POST /routes/:id/baseline` — upload the manager's actual "usual route" for a
completed job as a CSV of stops in driving order. Header must include `sequence`
plus either `delivery_id` (exact match) or `customer_name` (matched against the
job's deliveries). The stops are run through the same matrix as the job and saved
as `analysis.baseline` with `source: "uploaded"`. The CSV must cover exactly the
job's deliveries (no extras, duplicates, or omissions) or the request is 400.

`DashboardStats`:
```
{ total_deliveries, total_vehicles, total_depots,
  optimized_routes, total_distance, total_time }
```

## Optimization service (Python, internal, base `/`)

`POST /solve`:
```
{ num_vehicles: int,
  depot_index: 0,
  distance_matrix: number[][],   // meters, square (n = stops + 1)
  time_matrix: number[][],       // seconds
  demands: number[],             // index-aligned, demands[depot_index] = 0
  vehicle_capacities: number[],  // length == num_vehicles
  objective: "distance" | "time" }
```
Returns:
```
{ status: "OK" | "NO_SOLUTION",
  routes: [ { vehicle: int, stops: int[], distance: number, time: number, load: number } ],
  dropped: int[] }              // matrix indices that could not be served
```
`stops` are matrix indices and include the depot at start and end (e.g. `[0, 3, 5, 0]`).
The backend maps indices 1..n back to delivery IDs (index 0 = depot).

`GET /health` → `{ status: "ok" }`
