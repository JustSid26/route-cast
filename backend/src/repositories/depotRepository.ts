import { query, queryOne } from '../config/db';
import { Depot, DepotStock } from '../types';
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

  /** All per-brand stock rows across depots (for stock-aware dispatch). */
  allStock: () =>
    query<DepotStock>('SELECT depot_id, brand, category, bottles FROM depot_stock'),

  create: (d: DepotInput) =>
    queryOne<Depot>(
      `INSERT INTO depots (name, address, latitude, longitude)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [d.name, d.address, d.latitude, d.longitude]
    ),

  /** Bulk insert used by CSV/Excel import; single multi-row statement. */
  createMany: async (rows: DepotInput[]): Promise<number> => {
    if (rows.length === 0) return 0;
    const values: string[] = [];
    const params: unknown[] = [];
    rows.forEach((d, i) => {
      const o = i * 4;
      values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4})`);
      params.push(d.name, d.address, d.latitude, d.longitude);
    });
    const inserted = await query<{ id: string }>(
      `INSERT INTO depots (name, address, latitude, longitude)
       VALUES ${values.join(',')} RETURNING id`,
      params
    );
    return inserted.length;
  },

  update: (id: string, d: DepotInput) =>
    queryOne<Depot>(
      `UPDATE depots SET name=$2, address=$3, latitude=$4, longitude=$5
       WHERE id=$1 RETURNING ${COLS}`,
      [id, d.name, d.address, d.latitude, d.longitude]
    ),

  remove: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM depots WHERE id=$1 RETURNING id`, [id]),
};
