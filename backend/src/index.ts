import { createApp } from './app';
import { env, orsEnabled } from './config/env';
import { pool } from './config/db';

async function main() {
  const app = createApp();

  // Fail fast if the database is unreachable at boot.
  try {
    await pool.query('SELECT 1');
    console.log('[db] connected');
  } catch (err) {
    console.error('[db] connection failed:', (err as Error).message);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`[backend] listening on :${env.port}`);
    console.log(`[backend] distance matrix source: ${orsEnabled ? 'OpenRouteService' : 'Haversine fallback'}`);
  });
}

main().catch((err) => {
  console.error('[backend] fatal startup error', err);
  process.exit(1);
});
