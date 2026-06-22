import { query, queryOne } from '../config/db';
import { Depot } from '../types';
import { DepotInput } from '../validation/schemas';

const COLS =
  'id, name, address, latitude, longitude, created_at, updated_at';

export const depotRepository = {
  findAll: () =>
    query<Depot>(`SELECT ${COLS} FROM depots ORDER BY created_at DESC`),

  findById: (id: string) =>
    queryOne<Depot>(`SELECT ${COLS} FROM depots WHERE id = $1`, [id]),

  findByIds: (ids: string[]) =>
    query<Depot>(`SELECT ${COLS} FROM depots WHERE id = ANY($1)`, [ids]),

  create: (d: DepotInput) =>
    queryOne<Depot>(
      `INSERT INTO depots (name, address, latitude, longitude)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [d.name, d.address, d.latitude, d.longitude]
    ),

  update: (id: string, d: DepotInput) =>
    queryOne<Depot>(
      `UPDATE depots SET name=$2, address=$3, latitude=$4, longitude=$5
       WHERE id=$1 RETURNING ${COLS}`,
      [id, d.name, d.address, d.latitude, d.longitude]
    ),

  remove: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM depots WHERE id=$1 RETURNING id`, [id]),
};
