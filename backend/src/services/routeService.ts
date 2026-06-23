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
import { DeliveryStop, RouteAnalysis, RouteResult, Vehicle } from '../types';
import { OptimizeInput } from '../validation/schemas';

// Route colours chosen to contrast OpenStreetMap basemaps — warm reds, oranges,
// purples and magentas, which never appear as map fills (greens=parks,
// blues=water). Avoids green/blue/teal so routes don't dissolve into the map.
const PALETTE = [
  '#e11d48', '#9333ea', '#ea580c', '#db2777', '#c026d3',
  '#7c3aed', '#b91c1c', '#a21caf', '#be185d', '#9f1239',
];

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
    const depot = await depotRepository.findById(input.depot_id);
    if (!depot) throw AppError.badRequest('depot_id does not reference an existing depot');

    const vehicles: Vehicle[] = input.vehicle_ids?.length
      ? await vehicleRepository.findByIds(input.vehicle_ids)
      : await vehicleRepository.findActive();
    const activeVehicles = vehicles.filter((v) => v.active);
    if (activeVehicles.length === 0) {
      throw AppError.badRequest('No active vehicles available for optimisation');
    }

    const deliveries = input.delivery_ids?.length
      ? await deliveryRepository.findByIds(input.delivery_ids)
      : await deliveryRepository.findAll();
    if (deliveries.length === 0) {
      throw AppError.badRequest('No deliveries selected for optimisation');
    }

    // Index 0 = depot, 1..n = deliveries.
    const points = [
      { latitude: depot.latitude, longitude: depot.longitude },
      ...deliveries.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
    ];

    const job = await routeRepository.createJob(input.depot_id, input.objective);
    if (!job) throw new AppError(500, 'Failed to create route job');

    try {
      const matrix = await buildMatrix(points);

      const solution = await solve({
        num_vehicles: activeVehicles.length,
        depot_index: 0,
        distance_matrix: matrix.distances,
        time_matrix: matrix.durations,
        demands: [0, ...deliveries.map((d) => d.weight)],
        vehicle_capacities: activeVehicles.map((v) => v.capacity_kg),
        objective: input.objective,
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
          const vehicle = activeVehicles[route.vehicle];
          const stops: DeliveryStop[] = [];
          // Ordered waypoints (depot → stops → depot) as [lat,lng].
          const waypoints: [number, number][] = [];
          let seq = 1;
          for (const matrixIndex of route.stops) {
            if (matrixIndex === 0) {
              waypoints.push([depot.latitude, depot.longitude]);
              continue;
            }
            const d = deliveries[matrixIndex - 1];
            waypoints.push([d.latitude, d.longitude]);
            stops.push({
              delivery_id: d.id,
              customer_name: d.customer_name,
              latitude: d.latitude,
              longitude: d.longitude,
              weight: d.weight,
              sequence: seq++,
            });
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
      // using the same matrix, so the comparison is verifiable.
      const analysis = computeBaselines(matrix.distances, matrix.durations, {
        distance: summary.total_distance,
        time: summary.total_time,
      });

      // Build the "usual" route as drawable data (single vehicle, entered order).
      // `source: 'mock'` today; an uploaded baseline can replace it later.
      // Fetched LAST (after the optimized routes are already resolved above), so a
      // rate-limited baseline call can only fall back to straight lines for itself
      // — it can never degrade the optimized routes' road geometry.
      const usualWaypoints: [number, number][] = [
        [depot.latitude, depot.longitude],
        ...deliveries.map((d) => [d.latitude, d.longitude] as [number, number]),
        [depot.latitude, depot.longitude],
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
