import { Pool, QueryResultRow } from 'pg';
import { env } from './env';

// A single shared connection pool for the whole process.
export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on('error', (err) => {
  // Surface unexpected idle-client errors instead of crashing silently.
  console.error('[db] unexpected pool error', err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
