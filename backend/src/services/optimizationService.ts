import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { Objective } from '../types';

export interface SolveRequest {
  num_vehicles: number;
  depot_index: number;
  distance_matrix: number[][];
  time_matrix: number[][];
  demands: number[];
  vehicle_capacities: number[];
  objective: Objective;
  // Multi-depot: per-vehicle home-depot node indices.
  starts?: number[];
  ends?: number[];
  // Per-node drop penalty encoding delivery priority.
  penalties?: number[];
}

export interface SolvedRoute {
  vehicle: number;       // index into the vehicles array passed by the caller
  stops: number[];       // matrix indices incl. depot at both ends
  distance: number;      // meters
  time: number;          // seconds
  load: number;          // kg
}

export interface SolveResponse {
  status: 'OK' | 'NO_SOLUTION';
  routes: SolvedRoute[];
  dropped: number[];
}

/** Thin client over the Python OR-Tools service. */
export async function solve(req: SolveRequest): Promise<SolveResponse> {
  try {
    const { data } = await axios.post<SolveResponse>(
      `${env.optimizationServiceUrl}/solve`,
      req,
      { timeout: 60_000 }
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data?.detail ?? err.message;
      throw AppError.upstream(`Optimization service error: ${detail}`);
    }
    throw AppError.upstream('Optimization service is unreachable');
  }
}
