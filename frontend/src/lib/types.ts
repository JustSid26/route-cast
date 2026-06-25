// Client-side mirror of the backend domain types (see CONTRACT.md).

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
  created_at: string;
  updated_at: string;
}

export type RouteStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Objective = 'distance' | 'time';

export interface ScenarioMetric {
  distance: number;
  time: number;
}

export interface BaselineRoute {
  source: 'mock' | 'uploaded';
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
  baseline?: BaselineRoute;
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
  analysis?: RouteAnalysis | Record<string, never>;
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

export interface RouteJobDetail {
  job: RouteJob;
  results: RouteResult[];
}

export interface DashboardStats {
  total_deliveries: number;
  total_vehicles: number;
  total_depots: number;
  optimized_routes: number;
  total_distance: number;
  total_time: number;
  distance_saved: number;
  time_saved: number;
}

export interface CsvValidation {
  rows: number;
  valid: number;
  errors: { row: number; message: string }[];
}

export interface CsvImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

export interface GeoResult {
  label: string;
  latitude: number;
  longitude: number;
}

// Inventory imports (uploaded Excel stored whole as JSON).
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

export interface InventoryImportSummary {
  id: string;
  filename: string;
  sheet_count: number;
  row_count: number;
  created_at: string;
}

// Input payloads (omit server-managed fields)
export type DepotInput = Omit<Depot, 'id' | 'created_at' | 'updated_at'>;
export type VehicleInput = Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>;
export type DeliveryInput = Omit<Delivery, 'id' | 'created_at' | 'updated_at'>;
export interface VehicleDepotAssignment {
  vehicle_id: string;
  depot_id: string;
}
export interface OptimizeInput {
  objective: Objective;
  // Multi-depot: which vehicle departs from which depot.
  assignments: VehicleDepotAssignment[];
  delivery_ids?: string[];
}
