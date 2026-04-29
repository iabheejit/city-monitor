/**
 * CLI script to delete recent DB snapshots for a given type,
 * forcing the freshness check to mark the job as stale on next server restart.
 *
 * Usage:
 *   npm run db:invalidate <snapshot-type> [--city <cityId>] [--all]
 *
 * Examples:
 *   npm run db:invalidate aponet           # delete latest aponet snapshot (all cities)
 *   npm run db:invalidate aponet --city berlin  # delete latest aponet snapshot for berlin only
 *   npm run db:invalidate aponet --all     # delete ALL aponet snapshots
 *   npm run db:invalidate --list           # list available snapshot types
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import { SNAPSHOT_TYPES } from '../db/schema.js';

const args = process.argv.slice(2);

if (args.includes('--list') || args.length === 0) {
  console.log('Available snapshot types:');
  for (const t of SNAPSHOT_TYPES) {
    console.log(`  ${t}`);
  }
  process.exit(0);
}

const snapshotType = args[0];
if (!SNAPSHOT_TYPES.includes(snapshotType as typeof SNAPSHOT_TYPES[number])) {
  console.error(`Unknown snapshot type: "${snapshotType}"`);
  console.error(`Run with --list to see available types.`);
  process.exit(1);
}

const cityIdx = args.indexOf('--city');
const cityId = cityIdx !== -1 ? args[cityIdx + 1] : undefined;
const deleteAll = args.includes('--all');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

try {
  if (deleteAll) {
    // Delete all snapshots of this type
    const conditions = cityId
      ? and(eq(schema.snapshots.type, snapshotType), eq(schema.snapshots.cityId, cityId))
      : eq(schema.snapshots.type, snapshotType);

    const deleted = await db.delete(schema.snapshots).where(conditions).returning({ id: schema.snapshots.id });
    console.log(`Deleted ${deleted.length} "${snapshotType}" snapshot(s)${cityId ? ` for ${cityId}` : ''}.`);
  } else {
    // Delete only the latest snapshot(s) — one per city or for a specific city
    const conditions = cityId
      ? and(eq(schema.snapshots.type, snapshotType), eq(schema.snapshots.cityId, cityId))
      : eq(schema.snapshots.type, snapshotType);

    // Find distinct cities with this snapshot type
    const latest = await db
      .select({ id: schema.snapshots.id, cityId: schema.snapshots.cityId, fetchedAt: schema.snapshots.fetchedAt })
      .from(schema.snapshots)
      .where(conditions)
      .orderBy(desc(schema.snapshots.fetchedAt))
      .limit(50);

    if (latest.length === 0) {
      console.log(`No "${snapshotType}" snapshots found${cityId ? ` for ${cityId}` : ''}.`);
    } else {
      // Get the most recent per city
      const seen = new Set<string>();
      const toDelete: number[] = [];
      for (const row of latest) {
        if (!seen.has(row.cityId)) {
          seen.add(row.cityId);
          toDelete.push(row.id);
        }
      }

      for (const id of toDelete) {
        await db.delete(schema.snapshots).where(eq(schema.snapshots.id, id));
      }
      const cities = [...seen].join(', ');
      console.log(`Deleted latest "${snapshotType}" snapshot for: ${cities}`);
    }
  }

  console.log('Restart the server to trigger re-ingestion.');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
} finally {
  await client.end();
}
