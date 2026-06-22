import { query, queryOne } from '../config/db';
import { Delivery } from '../types';
import { DeliveryInput } from '../validation/schemas';

const COLS =
  `id, customer_name, address, latitude, longitude, weight, volume,
   priority, created_at, updated_at`;

export const deliveryRepository = {
  findAll: () =>
    query<Delivery>(
      `SELECT ${COLS} FROM deliveries ORDER BY priority ASC, created_at DESC`
    ),

  findById: (id: string) =>
    queryOne<Delivery>(`SELECT ${COLS} FROM deliveries WHERE id = $1`, [id]),

  findByIds: (ids: string[]) =>
    query<Delivery>(
      `SELECT ${COLS} FROM deliveries WHERE id = ANY($1) ORDER BY priority ASC`,
      [ids]
    ),

  create: (d: DeliveryInput) =>
    queryOne<Delivery>(
      `INSERT INTO deliveries
         (customer_name, address, latitude, longitude, weight, volume, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLS}`,
      [d.customer_name, d.address, d.latitude, d.longitude, d.weight, d.volume, d.priority]
    ),

  /** Bulk insert used by CSV import; runs in a single multi-row statement. */
  createMany: async (rows: DeliveryInput[]): Promise<number> => {
    if (rows.length === 0) return 0;
    const values: string[] = [];
    const params: unknown[] = [];
    rows.forEach((d, i) => {
      const o = i * 7;
      values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7})`);
      params.push(d.customer_name, d.address, d.latitude, d.longitude, d.weight, d.volume, d.priority);
    });
    const inserted = await query<{ id: string }>(
      `INSERT INTO deliveries
         (customer_name, address, latitude, longitude, weight, volume, priority)
       VALUES ${values.join(',')} RETURNING id`,
      params
    );
    return inserted.length;
  },

  update: (id: string, d: DeliveryInput) =>
    queryOne<Delivery>(
      `UPDATE deliveries SET
         customer_name=$2, address=$3, latitude=$4, longitude=$5,
         weight=$6, volume=$7, priority=$8
       WHERE id=$1 RETURNING ${COLS}`,
      [id, d.customer_name, d.address, d.latitude, d.longitude, d.weight, d.volume, d.priority]
    ),

  remove: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM deliveries WHERE id=$1 RETURNING id`, [id]),
};
