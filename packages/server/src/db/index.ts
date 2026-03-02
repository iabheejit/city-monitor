/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('db');

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    log.info('DATABASE_URL not set — running without Postgres');
    return null;
  }

  const client = postgres(url);
  const db = drizzle(client, { schema });
  log.info('Connected to Postgres');
  return db;
}
