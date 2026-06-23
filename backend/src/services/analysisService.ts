// Baseline scenario analysis for an optimisation. All scenarios are measured
// with the SAME distance/time matrix used by the solver, so comparisons are
// apples-to-apples ("with proof"). Fuel/money are derived in the UI from these
// numbers with editable assumptions, keeping the calculation transparent.

import { ScenarioMetric, RouteAnalysis } from '../types';

/** Distance + time of a single-vehicle route depot → order[] → depot. */
export function routeCost(
  order: number[],
  distance: number[][],
  time: number[][]
): ScenarioMetric {
  let d = 0;
  let t = 0;
  let prev = 0; // depot
  for (const node of order) {
    d += distance[prev][node];
    t += time[prev][node];
    prev = node;
  }
  d += distance[prev][0];
  t += time[prev][0];
  return { distance: d, time: t };
}

function shuffled(indices: number[]): number[] {
  const a = [...indices];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Compute the baseline scenarios for the matrix. Index 0 is treated as the
 * reference depot; `deliveryIndices` are the matrix rows for the selected stops
 * (defaults to 1..n for the single-depot layout). The baseline is "one vehicle
 * from the main depot, unplanned" — the same reference across single/multi-depot
 * jobs, so savings stay comparable.
 */
export function computeBaselines(
  distance: number[][],
  time: number[][],
  optimized: ScenarioMetric,
  deliveryIndices?: number[]
): RouteAnalysis {
  const stops = deliveryIndices ?? Array.from({ length: distance.length - 1 }, (_, i) => i + 1);
  const n = stops.length;

  // Usual: stops in the order they were provided.
  const usual = routeCost(stops, distance, time);

  // Worst: a separate depot→stop→depot trip per stop.
  let worstD = 0;
  let worstT = 0;
  for (const i of stops) {
    worstD += distance[0][i] + distance[i][0];
    worstT += time[0][i] + time[i][0];
  }

  // Average: expected cost of an unplanned (random) ordering, via Monte-Carlo.
  const SAMPLES = n > 1 ? 300 : 1;
  let sumD = 0;
  let sumT = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const m = routeCost(shuffled(stops), distance, time);
    sumD += m.distance;
    sumT += m.time;
  }

  return {
    stops: n,
    optimized: { distance: Math.round(optimized.distance), time: Math.round(optimized.time) },
    usual: { distance: Math.round(usual.distance), time: Math.round(usual.time) },
    average: { distance: Math.round(sumD / SAMPLES), time: Math.round(sumT / SAMPLES) },
    worst: { distance: Math.round(worstD), time: Math.round(worstT) },
  };
}
