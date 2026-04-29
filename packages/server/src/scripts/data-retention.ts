/**
 * CLI script to manually run data retention (prune old rows).
 * Use this from Render's Shell when the cron misses a run.
 *
 * Usage:
 *   npm run db:retain
 *
 * On Render Shell (from project root):
 *   node packages/server/dist/scripts/data-retention.js
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import { runDataRetention } from '../cron/data-retention.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

try {
  console.log('Running data retention...');
  await runDataRetention(db);
  console.log('Done.');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
} finally {
  await client.end();
}
