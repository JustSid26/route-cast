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

// Multi-depot: which vehicle departs from which depot. The full set of depots
// in play is derived from the distinct depot_ids here.
const assignmentSchema = z.object({
  vehicle_id: z.string().uuid(),
  depot_id: z.string().uuid(),
});

export const optimizeSchema = z
  .object({
    objective: z.enum(['distance', 'time']).default('distance'),
    delivery_ids: z.array(z.string().uuid()).optional(),
    // New multi-depot input: per-vehicle home depot.
    assignments: z.array(assignmentSchema).min(1).optional(),
    // Legacy single-depot input (kept for backward compatibility / API clients).
    // When `assignments` is absent these build a single-depot assignment.
    depot_id: z.string().uuid('depot_id must be a valid UUID').optional(),
    vehicle_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((d) => (d.assignments && d.assignments.length > 0) || d.depot_id, {
    message: 'Provide assignments[] (vehicle→depot) or a depot_id',
  });

export const csvSchema = z.object({
  csv: z.string().min(1, 'csv content is required'),
});

export type DepotInput = z.infer<typeof depotSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type DeliveryInput = z.infer<typeof deliverySchema>;
export type OptimizeInput = z.infer<typeof optimizeSchema>;
