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

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1); // [1..n]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Compute the baseline scenarios for a matrix where index 0 is the depot and
 * 1..n are the (selected) stops in entered order.
 */
export function computeBaselines(
  distance: number[][],
  time: number[][],
  optimized: ScenarioMetric
): RouteAnalysis {
  const n = distance.length - 1;
  const enteredOrder = Array.from({ length: n }, (_, i) => i + 1);

  // Usual: stops in the order they were provided.
  const usual = routeCost(enteredOrder, distance, time);

  // Worst: a separate depot→stop→depot trip per stop.
  let worstD = 0;
  let worstT = 0;
  for (let i = 1; i <= n; i++) {
    worstD += distance[0][i] + distance[i][0];
    worstT += time[0][i] + time[i][0];
  }

  // Average: expected cost of an unplanned (random) ordering, via Monte-Carlo.
  const SAMPLES = n > 1 ? 300 : 1;
  let sumD = 0;
  let sumT = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const m = routeCost(shuffled(n), distance, time);
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
