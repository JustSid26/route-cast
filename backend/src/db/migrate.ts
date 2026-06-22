// Local-dev migration runner (Docker applies these via docker-entrypoint-initdb.d).
// Usage: npm run migrate  [-- --seed]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../config/db';

async function run() {
  const migrationsDir = join(__dirname, '../../..', 'db', 'migrations');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    await pool.query(sql);
  }

  if (process.argv.includes('--seed')) {
    const seed = readFileSync(join(migrationsDir, '..', 'seed.sql'), 'utf8');
    console.log('[migrate] applying seed.sql');
    await pool.query(seed);
  }

  console.log('[migrate] done');
  await pool.end();
}

run().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
