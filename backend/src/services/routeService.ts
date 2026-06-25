import { depotRepository } from '../repositories/depotRepository';
import { vehicleRepository } from '../repositories/vehicleRepository';
import { deliveryRepository } from '../repositories/deliveryRepository';
import { routeRepository } from '../repositories/routeRepository';
import { buildMatrix } from './matrixService';
import { roadGeometry } from './directionsService';
import { solve } from './optimizationService';
import { computeBaselines, routeCost } from './analysisService';
import { parseUsualRoute } from './csvService';
import { AppError } from '../utils/AppError';
import { haversineMeters } from '../utils/geo';
import { Delivery, DeliveryStop, Depot, DispatchAssignment, RouteAnalysis, RouteResult, Vehicle } from '../types';
import { OptimizeInput, DispatchInput } from '../validation/schemas';

// Bold, map-contrasting hues — one per warehouse on the dispatch map.
const HUB_COLORS = [
  '#dc2626', '#ea580c', '#9333ea', '#db2777', '#b45309',
  '#7c3aed', '#be123c', '#a16207', '#c026d3', '#9f1239',
];

// Route colours chosen to contrast OpenStreetMap basemaps — warm reds, oranges,
// purples and magentas, which never appear as map fills (greens=parks,
// blues=water). Avoids green/blue/teal so routes don't dissolve into the map.
const PALETTE = [
  '#e11d48', '#9333ea', '#ea580c', '#db2777', '#c026d3',
  '#7c3aed', '#b91c1c', '#a21caf', '#be185d', '#9f1239',
];

/**
 * Per-node drop penalties encoding delivery priority. When capacity forces a
 * delivery to be dropped, the solver drops the *lowest-penalty* node first.
 *  - If the user set differing priorities (1..5), use them directly.
 *  - If priorities are all equal (i.e. unspecified), derive importance from
 *    weight so the heaviest unit is served first ("logically highest priority").
 * The base penalty exceeds the total matrix cost, so dropping is always a last
 * resort — priority only decides *which* node drops, never trades a stop for a
 * shorter detour. `depotCount` leading zeros align the array to the node layout.
 */
function priorityPenalties(deliveries: Delivery[], cost: number[][], depotCount: number): number[] {
  const total = cost.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  const base = total + 1;

  const priorities = deliveries.map((d) => d.priority ?? 3);
  const userSetPriorities = new Set(priorities).size > 1;

  let importance: number[];
  if (userSetPriorities) {
    importance = priorities; // explicit 1..5
  } else {
    const maxW = Math.max(0, ...deliveries.map((d) => d.weight ?? 0));
    importance = maxW > 0
      ? deliveries.map((d) => 1 + (d.weight ?? 0) / maxW) // lightest≈1 … heaviest≈2
      : deliveries.map(() => 1);
  }

  return [
    ...Array(depotCount).fill(0),
    ...importance.map((im) => Math.round(base * im)),
  ];
}

export const routeService = {
  listJobs: () => routeRepository.listJobs(),

  getJob: async (id: string) => {
    const job = await routeRepository.findJob(id);
    if (!job) throw AppError.notFound('Route job not found');
    const results = await routeRepository.findResults(id);
    return { job, results };
  },

  removeJob: async (id: string) => {
    const removed = await routeRepository.removeJob(id);
    if (!removed) throw AppError.notFound('Route job not found');
  },

  dashboard: () => routeRepository.dashboard(),

  /**
   * Stock-aware dispatch: assign each client's order to the NEAREST warehouse that
   * still has enough of the ordered brand (stock depletes as orders are claimed);
   * fall back to next-nearest, or flag unfulfillable. Then optimize a route per
   * warehouse by reusing `optimize` (legacy single-depot call). Highest priority
   * claims stock first.
   */
  optimizeDispatch: async (input: DispatchInput) => {
    const depots = input.depot_ids?.length
      ? await depotRepository.findByIds(input.depot_ids)
      : await depotRepository.findAll();
    if (depots.length === 0) throw AppError.badRequest('No warehouses available for dispatch');

    const deliveries = input.delivery_ids?.length
      ? await deliveryRepository.findByIds(input.delivery_ids)
      : await deliveryRepository.findWithOrders();
    if (deliveries.length === 0) throw AppError.badRequest('No client orders to dispatch');

    // Mutable per-brand stock: depotId → brand → bottles remaining.
    const stock = new Map<string, Map<string, number>>();
    for (const s of await depotRepository.allStock()) {
      if (!stock.has(s.depot_id)) stock.set(s.depot_id, new Map());
      stock.get(s.depot_id)!.set(s.brand, s.bottles);
    }

    const groups = new Map<string, string[]>();
    const addTo = (depotId: string, id: string) => {
      const arr = groups.get(depotId);
      if (arr) arr.push(id); else groups.set(depotId, [id]);
    };

    const ordered = [...deliveries].sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id));
    const assignments: DispatchAssignment[] = [];

    for (const d of ordered) {
      const byDist = [...depots].sort((x, y) => haversineMeters(d, x) - haversineMeters(d, y));
      const nearest = byDist[0] ?? null;
      const base = {
        delivery_id: d.id, customer_name: d.customer_name,
        order_category: d.order_category, order_brand: d.order_brand, order_qty: d.order_qty,
        nearest_depot_id: nearest?.id ?? null, nearest_depot_name: nearest?.name ?? null,
      };

      if (!d.order_brand || d.order_qty <= 0) {
        if (nearest) addTo(nearest.id, d.id);
        assignments.push({ ...base, assigned_depot_id: nearest?.id ?? null, assigned_depot_name: nearest?.name ?? null, status: 'no_order' });
        continue;
      }

      const chosen = byDist.find((dep) => (stock.get(dep.id)?.get(d.order_brand) ?? 0) >= d.order_qty) ?? null;
      if (chosen) {
        const m = stock.get(chosen.id)!;
        m.set(d.order_brand, (m.get(d.order_brand) ?? 0) - d.order_qty);
        addTo(chosen.id, d.id);
        const fallback = chosen.id !== nearest?.id;
        assignments.push({
          ...base, assigned_depot_id: chosen.id, assigned_depot_name: chosen.name,
          status: fallback ? 'fallback' : 'nearest',
          reason: fallback ? `${nearest?.name} was short on ${d.order_brand}` : undefined,
        });
      } else {
        assignments.push({
          ...base, assigned_depot_id: null, assigned_depot_name: null, status: 'unfulfillable',
          reason: `No warehouse has ${d.order_qty} × ${d.order_brand} in stock`,
        });
      }
    }

    const plan: { depot: typeof depots[number]; job: Awaited<ReturnType<typeof routeService.getJob>>['job']; results: RouteResult[] }[] = [];
    let hue = 0;
    for (const depot of depots) {
      const assigned = groups.get(depot.id);
      if (!assigned || assigned.length === 0) continue;
      try {
        const detail = await routeService.optimize({
          objective: input.objective,
          depot_id: depot.id,
          vehicle_ids: input.vehicle_ids,
          delivery_ids: assigned,
          ignore_capacity: true,
        });
        const color = HUB_COLORS[hue++ % HUB_COLORS.length];
        plan.push({ depot, job: detail.job, results: detail.results.map((r) => ({ ...r, color })) });
      } catch {
        // A hub that can't be solved is still reflected in `assignments`; skip its route.
      }
    }

    const count = (s: DispatchAssignment['status']) => assignments.filter((a) => a.status === s).length;
    const summary = {
      orders: assignments.length,
      fulfilled: count('nearest') + count('no_order'),
      fallback: count('fallback'),
      unfulfillable: count('unfulfillable'),
      warehouses: plan.length,
      total_distance: plan.reduce((s, p) => s + p.job.total_distance, 0),
      total_time: plan.reduce((s, p) => s + p.job.total_time, 0),
      stop_count: plan.reduce((s, p) => s + p.job.stop_count, 0),
    };
    return { plan, assignments, summary, generated_at: new Date().toISOString() };
  },

  /**
   * Replace a completed job's baseline with the manager's actual "usual route".
   * The uploaded stop order is run through the SAME matrix construction as
   * `optimize` (depot at index 0), so optimized-vs-usual stays comparable, and
   * the baseline is marked `source: 'uploaded'` (drops the UI "(estimated)" tag).
   */
  uploadBaseline: async (jobId: string, input: { csv: string }) => {
    const { job } = await routeService.getJob(jobId);
    const analysis = job.analysis as RouteAnalysis;
    if (job.status !== 'completed' || !analysis.baseline) {
      throw AppError.badRequest('A baseline can only be uploaded for a completed route');
    }
    if (!job.depot_id) throw AppError.badRequest('Route has no depot');
    const depot = await depotRepository.findById(job.depot_id);
    if (!depot) throw AppError.badRequest('Route depot no longer exists');

    // Reorder the job's deliveries into the manager's actual driving order.
    const ordered = parseUsualRoute(input.csv, analysis.baseline.stop_sequence);

    // Same point layout as optimize(): index 0 = depot, 1..n = stops (in order).
    const points = [
      { latitude: depot.latitude, longitude: depot.longitude },
      ...ordered.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    ];
    const matrix = await buildMatrix(points);
    const cost = routeCost(
      ordered.map((_, i) => i + 1),
      matrix.distances,
      matrix.durations
    );

    const waypoints: [number, number][] = [
      [depot.latitude, depot.longitude],
      ...ordered.map((s) => [s.latitude, s.longitude] as [number, number]),
      [depot.latitude, depot.longitude],
    ];
    const road = await roadGeometry(
      waypoints.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
    );

    // The uploaded route IS now the "usual" scenario, so the savings panel and
    // dashboard (both keyed on analysis.usual) compare against it — not just the
    // drawn baseline. optimized/average/worst stay as computed at solve time.
    const usual = { distance: Math.round(cost.distance), time: Math.round(cost.time) };
    analysis.usual = usual;
    analysis.baseline = {
      source: 'uploaded',
      stop_sequence: ordered.map((s, i) => ({ ...s, sequence: i + 1 })),
      geometry: road ?? waypoints,
      total_distance: usual.distance,
      total_time: usual.time,
    };

    await routeRepository.updateAnalysis(jobId, analysis);
    return routeService.getJob(jobId);
  },

  /**
   * End-to-end optimisation: resolve inputs → build matrix → solve → persist.
   * Synchronous for the MVP (request waits for the result); the job/result
   * tables make it straightforward to move to async/queued execution later.
   */
  optimize: async (input: OptimizeInput) => {
    // Normalise input to per-vehicle assignments [{ vehicle_id, depot_id }].
    // New clients send `assignments`; legacy single-depot clients send
    // `depot_id` (+ optional `vehicle_ids`), which we expand to all-from-one-depot.
    let rawAssignments: { vehicle_id: string; depot_id: string }[];
    if (input.assignments && input.assignments.length > 0) {
      rawAssignments = input.assignments;
    } else {
      const depotId = input.depot_id!;
      const legacyVehicles = input.vehicle_ids?.length
        ? await vehicleRepository.findByIds(input.vehicle_ids)
        : await vehicleRepository.findActive();
      rawAssignments = legacyVehicles
        .filter((v) => v.active)
        .map((v) => ({ vehicle_id: v.id, depot_id: depotId }));
    }
    if (rawAssignments.length === 0) {
      throw AppError.badRequest('No vehicles assigned to a depot for optimisation');
    }

    // Resolve vehicles (active only), preserving assignment order.
    const vehicleRows = await vehicleRepository.findByIds(rawAssignments.map((a) => a.vehicle_id));
    const vehicleById = new Map(vehicleRows.map((v) => [v.id, v]));
    const assignments = rawAssignments
      .map((a) => ({ depot_id: a.depot_id, vehicle: vehicleById.get(a.vehicle_id) }))
      .filter((a): a is { depot_id: string; vehicle: Vehicle } => !!a.vehicle && a.vehicle.active);
    if (assignments.length === 0) {
      throw AppError.badRequest('No active vehicles available for optimisation');
    }

    // Distinct depots in play, in first-seen order → matrix node indices 0..D-1.
    const depotIds = [...new Set(assignments.map((a) => a.depot_id))];
    const depotRows = await depotRepository.findByIds(depotIds);
    const depotById = new Map(depotRows.map((d) => [d.id, d]));
    const depots = depotIds.map((id) => depotById.get(id)).filter((d): d is Depot => !!d);
    if (depots.length !== depotIds.length) {
      throw AppError.badRequest('One or more depot_ids do not reference an existing depot');
    }
    const depotIndexOf = new Map(depots.map((d, i) => [d.id, i]));
    const D = depots.length;

    const deliveries = input.delivery_ids?.length
      ? await deliveryRepository.findByIds(input.delivery_ids)
      : await deliveryRepository.findAll();
    if (deliveries.length === 0) {
      throw AppError.badRequest('No deliveries selected for optimisation');
    }

    // Node layout: indices 0..D-1 = depots, D.. = deliveries.
    const points = [
      ...depots.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
      ...deliveries.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
    ];

    // The first depot in play is the job's primary depot (kept on route_jobs for
    // backward-compat and the savings baseline / dashboard rollups).
    const job = await routeRepository.createJob(depots[0].id, input.objective);
    if (!job) throw new AppError(500, 'Failed to create route job');

    try {
      const matrix = await buildMatrix(points);

      // Each vehicle starts and ends at its assigned depot's node index.
      const starts = assignments.map((a) => depotIndexOf.get(a.depot_id)!);
      const costMatrix = input.objective === 'distance' ? matrix.distances : matrix.durations;

      const solution = await solve({
        num_vehicles: assignments.length,
        depot_index: 0,
        distance_matrix: matrix.distances,
        time_matrix: matrix.durations,
        demands: [...depots.map(() => 0), ...deliveries.map((d) => d.weight)],
        // ignore_capacity (Trip Planner): give the solver effectively unlimited
        // capacity so no stop is dropped; utilisation below still uses real capacity.
        vehicle_capacities: assignments.map((a) =>
          input.ignore_capacity ? 1_000_000_000 : a.vehicle.capacity_kg),
        objective: input.objective,
        starts,
        ends: starts,
        penalties: priorityPenalties(deliveries, costMatrix, D),
      });

      if (solution.status !== 'OK') {
        await routeRepository.markFailed(job.id, 'Solver found no feasible solution');
        throw AppError.badRequest(
          'No feasible solution — capacity may be insufficient for the selected deliveries'
        );
      }

      if (solution.dropped.length > 0) {
        console.warn(
          `[optimize] job ${job.id}: ${solution.dropped.length} deliveries could not be served`
        );
      }

      const results: Omit<RouteResult, 'id' | 'job_id' | 'created_at'>[] = await Promise.all(
        solution.routes.map(async (route, i) => {
          const assignment = assignments[route.vehicle];
          const vehicle = assignment.vehicle;
          const homeDepot = depots[depotIndexOf.get(assignment.depot_id)!];
          const stops: DeliveryStop[] = [];
          // Ordered waypoints (depot → stops → depot) as [lat,lng].
          const waypoints: [number, number][] = [];
          let seq = 1;
          let prevIdx = depotIndexOf.get(assignment.depot_id)!; // start at home depot
          for (const matrixIndex of route.stops) {
            if (matrixIndex < D) {
              const dp = depots[matrixIndex]; // a depot node (this vehicle's home)
              waypoints.push([dp.latitude, dp.longitude]);
              prevIdx = matrixIndex;
              continue;
            }
            const d = deliveries[matrixIndex - D];
            waypoints.push([d.latitude, d.longitude]);
            stops.push({
              delivery_id: d.id,
              customer_name: d.customer_name,
              latitude: d.latitude,
              longitude: d.longitude,
              weight: d.weight,
              sequence: seq++,
              leg_distance: Math.round(matrix.distances[prevIdx][matrixIndex]),
              leg_time: Math.round(matrix.durations[prevIdx][matrixIndex]),
            });
            prevIdx = matrixIndex;
          }

          // Prefer the real road path; fall back to straight waypoint segments.
          const road = await roadGeometry(
            waypoints.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
          );
          const geometry = road ?? waypoints;

          const utilization = vehicle.capacity_kg > 0
            ? Math.round((route.load / vehicle.capacity_kg) * 1000) / 10
            : 0;
          return {
            vehicle_id: vehicle.id,
            vehicle_name: vehicle.name,
            depot_id: homeDepot.id,
            color: PALETTE[i % PALETTE.length],
            stop_sequence: stops,
            geometry,
            total_distance: Math.round(route.distance),
            total_time: Math.round(route.time),
            load_kg: route.load,
            utilization_pct: utilization,
          };
        })
      );

      const summary = {
        total_distance: results.reduce((s, r) => s + r.total_distance, 0),
        total_time: results.reduce((s, r) => s + r.total_time, 0),
        vehicle_count: results.length,
        stop_count: results.reduce((s, r) => s + r.stop_sequence.length, 0),
      };

      // Savings analysis: compare the optimized plan against baseline scenarios
      // using the same matrix, so the comparison is verifiable. Deliveries live
      // at node indices D..D+n-1; the baseline is measured from the primary
      // depot (index 0) — one unplanned vehicle, the same reference everywhere.
      const deliveryIndices = deliveries.map((_, i) => i + D);
      const analysis = computeBaselines(
        matrix.distances,
        matrix.durations,
        { distance: summary.total_distance, time: summary.total_time },
        deliveryIndices
      );

      // Build the "usual" route as drawable data (single vehicle from the primary
      // depot, entered order). `source: 'mock'` today; an uploaded baseline can
      // replace it later. Fetched LAST (after the optimized routes are already
      // resolved above), so a rate-limited baseline call can only fall back to
      // straight lines for itself — never degrading the optimized road geometry.
      const primaryDepot = depots[0];
      const usualWaypoints: [number, number][] = [
        [primaryDepot.latitude, primaryDepot.longitude],
        ...deliveries.map((d) => [d.latitude, d.longitude] as [number, number]),
        [primaryDepot.latitude, primaryDepot.longitude],
      ];
      const usualRoad = await roadGeometry(
        usualWaypoints.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      );
      analysis.baseline = {
        source: 'mock',
        stop_sequence: deliveries.map((d, i) => ({
          delivery_id: d.id,
          customer_name: d.customer_name,
          latitude: d.latitude,
          longitude: d.longitude,
          weight: d.weight,
          sequence: i + 1,
        })),
        geometry: usualRoad ?? usualWaypoints,
        total_distance: analysis.usual.distance,
        total_time: analysis.usual.time,
      };

      await routeRepository.completeJob(job.id, summary, results, analysis);
      return routeService.getJob(job.id);
    } catch (err) {
      if (err instanceof AppError) throw err;
      await routeRepository.markFailed(job.id, (err as Error).message);
      throw new AppError(500, `Optimisation failed: ${(err as Error).message}`);
    }
  },
};
