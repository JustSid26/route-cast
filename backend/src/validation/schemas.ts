import { z } from 'zod';

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const depotSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  address: z.string().trim().default(''),
  latitude,
  longitude,
});

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  registration_number: z.string().trim().default(''),
  capacity_kg: z.number().positive('capacity_kg must be > 0'),
  max_height_m: z.number().min(0).default(0),
  max_weight_kg: z.number().min(0).default(0),
  avg_speed_kmh: z.number().positive().default(40),
  active: z.boolean().default(true),
});

export const deliverySchema = z.object({
  customer_name: z.string().trim().min(1, 'customer_name is required'),
  address: z.string().trim().default(''),
  latitude,
  longitude,
  weight: z.number().min(0).default(0),
  volume: z.number().min(0).default(0),
  priority: z.number().int().min(1).max(5).default(3),
});

export const optimizeSchema = z.object({
  depot_id: z.string().uuid('depot_id must be a valid UUID'),
  objective: z.enum(['distance', 'time']).default('distance'),
  vehicle_ids: z.array(z.string().uuid()).optional(),
  delivery_ids: z.array(z.string().uuid()).optional(),
});

export const csvSchema = z.object({
  csv: z.string().min(1, 'csv content is required'),
});

export const inventoryImportSchema = z.object({
  filename: z.string().trim().min(1, 'filename is required'),
  sheets: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  })).min(1, 'at least one sheet is required'),
});

export type InventoryImportInput = z.infer<typeof inventoryImportSchema>;

export type DepotInput = z.infer<typeof depotSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type DeliveryInput = z.infer<typeof deliverySchema>;
export type OptimizeInput = z.infer<typeof optimizeSchema>;
