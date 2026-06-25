// Domain types shared across repositories, services and controllers.
// Mirrors CONTRACT.md.

export interface Depot {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  name: string;
  registration_number: string;
  capacity_kg: number;
  max_height_m: number;
  max_weight_kg: number;
  avg_speed_kmh: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  customer_name: string;
  address: string;
  latitude: number;
  longitude: number;
  weight: number;
  volume: number;
  priority: number;
  order_category: string;
  order_brand: string;
  order_qty: number;
  created_at: string;
  updated_at: string;
}

export interface DepotStock {
  depot_id: string;
  brand: string;
  category: string;
  bottles: number;
}

export interface DispatchAssignment {
  delivery_id: string;
  customer_name: string;
  order_category: string;
  order_brand: string;
  order_qty: number;
  nearest_depot_id: string | null;
  nearest_depot_name: string | null;
  assigned_depot_id: string | null;
  assigned_depot_name: string | null;
  status: 'nearest' | 'fallback' | 'unfulfillable' | 'no_order';
  reason?: string;
}

export type RouteStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Objective = 'distance' | 'time';

export interface ScenarioMetric {
  distance: number;
  time: number;
}

export interface BaselineRoute {
  source: 'mock' | 'uploaded'; // 'mock' = entered-order; 'uploaded' = user-provided (future)
  stop_sequence: DeliveryStop[];
  geometry: [number, number][];
  total_distance: number;
  total_time: number;
}

export interface RouteAnalysis {
  stops: number;
  optimized: ScenarioMetric;
  usual: ScenarioMetric;
  average: ScenarioMetric;
  worst: ScenarioMetric;
  baseline?: BaselineRoute; // the usual route as drawable data
}

export interface RouteJob {
  id: string;
  depot_id: string | null;
  status: RouteStatus;
  objective: Objective;
  total_distance: number;
  total_time: number;
  vehicle_count: number;
  stop_count: number;
  error: string | null;
  analysis: RouteAnalysis | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export interface DeliveryStop {
  delivery_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  weight: number;
  sequence: number;
  leg_distance?: number; // meters from the previous point (depot/prior stop)
  leg_time?: number;     // seconds from the previous point
}

export interface RouteResult {
  id: string;
  job_id: string;
  vehicle_id: string | null;
  vehicle_name: string;
  depot_id: string | null; // home depot this vehicle departs from (multi-depot)
  color: string;
  stop_sequence: DeliveryStop[];
  geometry: [number, number][];
  total_distance: number;
  total_time: number;
  load_kg: number;
  utilization_pct: number;
  created_at: string;
}

export interface InventorySheet {
  name: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
}

export interface InventoryImport {
  id: string;
  filename: string;
  sheet_count: number;
  row_count: number;
  data: { sheets: InventorySheet[] };
  created_at: string;
}

export interface DashboardStats {
  total_deliveries: number;
  total_vehicles: number;
  total_depots: number;
  optimized_routes: number;
  total_distance: number;
  total_time: number;
  // Cumulative savings vs. the "usual route" baseline across all completed jobs.
  distance_saved: number; // meters
  time_saved: number; // seconds
}
