import { pool, query, queryOne } from '../config/db';
import { RouteJob, RouteResult } from '../types';

const JOB_COLS =
  `id, depot_id, status, objective, total_distance, total_time,
   vehicle_count, stop_count, error, analysis, created_at, updated_at`;

const RESULT_COLS =
  `id, job_id, vehicle_id, vehicle_name, color, stop_sequence, geometry,
   total_distance, total_time, load_kg, utilization_pct, created_at`;

export const routeRepository = {
  listJobs: () =>
    query<RouteJob>(`SELECT ${JOB_COLS} FROM route_jobs ORDER BY created_at DESC`),

  findJob: (id: string) =>
    queryOne<RouteJob>(`SELECT ${JOB_COLS} FROM route_jobs WHERE id=$1`, [id]),

  findResults: (jobId: string) =>
    query<RouteResult>(
      `SELECT ${RESULT_COLS} FROM route_results WHERE job_id=$1 ORDER BY created_at ASC`,
      [jobId]
    ),

  createJob: (depotId: string, objective: string) =>
    queryOne<RouteJob>(
      `INSERT INTO route_jobs (depot_id, objective, status)
       VALUES ($1, $2, 'running') RETURNING ${JOB_COLS}`,
      [depotId, objective]
    ),

  markFailed: (id: string, error: string) =>
    queryOne<RouteJob>(
      `UPDATE route_jobs SET status='failed', error=$2 WHERE id=$1 RETURNING ${JOB_COLS}`,
      [id, error]
    ),

  removeJob: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM route_jobs WHERE id=$1 RETURNING id`, [id]),

  /** Replace only the analysis JSON for a job (e.g. swapping in an uploaded baseline). */
  updateAnalysis: (id: string, analysis: unknown) =>
    queryOne<RouteJob>(
      `UPDATE route_jobs SET analysis=$2 WHERE id=$1 RETURNING ${JOB_COLS}`,
      [id, JSON.stringify(analysis)]
    ),

  /**
   * Persist a completed optimisation atomically: update the job summary and
   * insert all per-vehicle results in one transaction.
   */
  completeJob: async (
    jobId: string,
    summary: { total_distance: number; total_time: number; vehicle_count: number; stop_count: number },
    results: Omit<RouteResult, 'id' | 'job_id' | 'created_at'>[],
    analysis: unknown
  ): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE route_jobs
           SET status='completed', total_distance=$2, total_time=$3,
               vehicle_count=$4, stop_count=$5, analysis=$6, error=NULL
         WHERE id=$1`,
        [jobId, summary.total_distance, summary.total_time, summary.vehicle_count,
         summary.stop_count, JSON.stringify(analysis)]
      );
      for (const r of results) {
        await client.query(
          `INSERT INTO route_results
             (job_id, vehicle_id, vehicle_name, color, stop_sequence, geometry,
              total_distance, total_time, load_kg, utilization_pct)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            jobId, r.vehicle_id, r.vehicle_name, r.color,
            JSON.stringify(r.stop_sequence), JSON.stringify(r.geometry),
            r.total_distance, r.total_time, r.load_kg, r.utilization_pct,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  dashboard: async () => {
    const [stats] = await query<{
      total_deliveries: string;
      total_vehicles: string;
      total_depots: string;
      optimized_routes: string;
    }>(
      `SELECT
         (SELECT count(*) FROM deliveries)                          AS total_deliveries,
         (SELECT count(*) FROM vehicles)                            AS total_vehicles,
         (SELECT count(*) FROM depots)                              AS total_depots,
         (SELECT count(*) FROM route_jobs WHERE status='completed') AS optimized_routes`
    );
    const [totals] = await query<{
      total_distance: number | null;
      total_time: number | null;
      distance_saved: number | null;
      time_saved: number | null;
    }>(
      // Savings = usual-route baseline minus optimized, clamped per job to >= 0.
      `SELECT
         COALESCE(SUM(total_distance),0) AS total_distance,
         COALESCE(SUM(total_time),0)     AS total_time,
         COALESCE(SUM(GREATEST(
           (analysis->'usual'->>'distance')::numeric
           - (analysis->'optimized'->>'distance')::numeric, 0)),0) AS distance_saved,
         COALESCE(SUM(GREATEST(
           (analysis->'usual'->>'time')::numeric
           - (analysis->'optimized'->>'time')::numeric, 0)),0)     AS time_saved
       FROM route_jobs WHERE status='completed'`
    );
    return {
      total_deliveries: Number(stats.total_deliveries),
      total_vehicles: Number(stats.total_vehicles),
      total_depots: Number(stats.total_depots),
      optimized_routes: Number(stats.optimized_routes),
      total_distance: Number(totals.total_distance ?? 0),
      total_time: Number(totals.total_time ?? 0),
      distance_saved: Number(totals.distance_saved ?? 0),
      time_saved: Number(totals.time_saved ?? 0),
    };
  },
};
