import { query, queryOne } from '../config/db';
import { Vehicle } from '../types';
import { VehicleInput } from '../validation/schemas';

const COLS =
  `id, name, registration_number, capacity_kg, max_height_m, max_weight_kg,
   avg_speed_kmh, active, created_at, updated_at`;

export const vehicleRepository = {
  findAll: () =>
    query<Vehicle>(`SELECT ${COLS} FROM vehicles ORDER BY created_at DESC`),

  findById: (id: string) =>
    queryOne<Vehicle>(`SELECT ${COLS} FROM vehicles WHERE id = $1`, [id]),

  findByIds: (ids: string[]) =>
    query<Vehicle>(`SELECT ${COLS} FROM vehicles WHERE id = ANY($1)`, [ids]),

  findActive: () =>
    query<Vehicle>(
      `SELECT ${COLS} FROM vehicles WHERE active = true ORDER BY capacity_kg DESC`
    ),

  create: (v: VehicleInput) =>
    queryOne<Vehicle>(
      `INSERT INTO vehicles
         (name, registration_number, capacity_kg, max_height_m,
          max_weight_kg, avg_speed_kmh, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLS}`,
      [v.name, v.registration_number, v.capacity_kg, v.max_height_m,
       v.max_weight_kg, v.avg_speed_kmh, v.active]
    ),

  update: (id: string, v: VehicleInput) =>
    queryOne<Vehicle>(
      `UPDATE vehicles SET
         name=$2, registration_number=$3, capacity_kg=$4, max_height_m=$5,
         max_weight_kg=$6, avg_speed_kmh=$7, active=$8
       WHERE id=$1 RETURNING ${COLS}`,
      [id, v.name, v.registration_number, v.capacity_kg, v.max_height_m,
       v.max_weight_kg, v.avg_speed_kmh, v.active]
    ),

  remove: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM vehicles WHERE id=$1 RETURNING id`, [id]),
};
