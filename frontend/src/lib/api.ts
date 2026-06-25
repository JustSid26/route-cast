import axios, { AxiosError } from 'axios';
import {
  Depot, DepotInput, Vehicle, VehicleInput, Delivery, DeliveryInput,
  RouteJob, RouteJobDetail, OptimizeInput, DashboardStats,
  CsvValidation, CsvImportResult, GeoResult,
  InventoryImport, InventoryImportSummary, InventorySheet,
  DispatchPlan, DispatchInput,
} from './types';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const http = axios.create({ baseURL });

/** Normalise backend error envelopes into a thrown Error with a readable message. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: { message?: string } }>;
    return e.response?.data?.error?.message ?? e.message;
  }
  return (err as Error).message ?? 'Unexpected error';
}

export const api = {
  // Depots
  listDepots: () => http.get<Depot[]>('/depots').then((r) => r.data),
  createDepot: (d: DepotInput) => http.post<Depot>('/depots', d).then((r) => r.data),
  updateDepot: (id: string, d: DepotInput) => http.put<Depot>(`/depots/${id}`, d).then((r) => r.data),
  deleteDepot: (id: string) => http.delete(`/depots/${id}`).then(() => undefined),

  // Vehicles
  listVehicles: () => http.get<Vehicle[]>('/vehicles').then((r) => r.data),
  createVehicle: (v: VehicleInput) => http.post<Vehicle>('/vehicles', v).then((r) => r.data),
  updateVehicle: (id: string, v: VehicleInput) => http.put<Vehicle>(`/vehicles/${id}`, v).then((r) => r.data),
  deleteVehicle: (id: string) => http.delete(`/vehicles/${id}`).then(() => undefined),

  // Deliveries
  listDeliveries: () => http.get<Delivery[]>('/deliveries').then((r) => r.data),
  createDelivery: (d: DeliveryInput) => http.post<Delivery>('/deliveries', d).then((r) => r.data),
  updateDelivery: (id: string, d: DeliveryInput) => http.put<Delivery>(`/deliveries/${id}`, d).then((r) => r.data),
  deleteDelivery: (id: string) => http.delete(`/deliveries/${id}`).then(() => undefined),
  validateCsv: (csv: string) => http.post<CsvValidation>('/deliveries/validate', { csv }).then((r) => r.data),
  importCsv: (csv: string) => http.post<CsvImportResult>('/deliveries/import', { csv }).then((r) => r.data),

  // Routes / optimisation
  listRoutes: () => http.get<RouteJob[]>('/routes').then((r) => r.data),
  getRoute: (id: string) => http.get<RouteJobDetail>(`/routes/${id}`).then((r) => r.data),
  deleteRoute: (id: string) => http.delete(`/routes/${id}`).then(() => undefined),
  optimize: (input: OptimizeInput) => http.post<RouteJobDetail>('/optimize', input).then((r) => r.data),
  optimizeDispatch: (input: DispatchInput) =>
    http.post<DispatchPlan>('/optimize/dispatch', input).then((r) => r.data),
  uploadBaseline: (jobId: string, csv: string) =>
    http.post<RouteJobDetail>(`/routes/${jobId}/baseline`, { csv }).then((r) => r.data),

  // Dashboard
  dashboard: () => http.get<DashboardStats>('/dashboard').then((r) => r.data),

  // Inventory (Excel upload → stored whole, rendered on the Inventory tab)
  getInventory: () => http.get<InventoryImport | null>('/inventory').then((r) => r.data),
  importInventory: (payload: { filename: string; sheets: InventorySheet[] }) =>
    http.post<InventoryImportSummary>('/inventory/import', payload).then((r) => r.data),

  // Geocoding (address → coordinates). An optional focus point biases results
  // toward that area (e.g. the selected hub) so local places are returned.
  geocode: (q: string, focus?: { latitude: number; longitude: number }) =>
    http
      .get<GeoResult[]>('/geocode', {
        params: { q, ...(focus ? { lat: focus.latitude, lng: focus.longitude } : {}) },
      })
      .then((r) => r.data),
};
