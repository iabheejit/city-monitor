/**
 * SF Street Closures ingestor — SFGOV Socrata dataset 98cv-qtqk.
 * Fetches active closures (end_date >= today).
 * Schedule: daily at 06:00.
 */
import type { SfStreetClosuresData, SfStreetClosure } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSfStreetClosures } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-sf-street-closures');

const TTL_SECONDS = 86_400; // 24h
const FETCH_TIMEOUT_MS = 20_000;
const LIMIT = 500;
const BASE_URL = 'https://data.sfgov.org/resource/98cv-qtqk.json';

async function fetchClosures(appToken: string | undefined): Promise<unknown[]> {
  // NOTE: dataset 98cv-qtqk does not support $where/$order on date columns,
  // so we fetch without filters and post-filter in JS.
  const params = new URLSearchParams({
    $limit: String(LIMIT),
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'CityMonitor/1.0',
  };
  if (appToken) headers['X-App-Token'] = appToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${BASE_URL}?${params}`, { headers, signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as unknown[];
  } finally {
    clearTimeout(timer);
  }
}

function parseClosures(rows: unknown[]): SfStreetClosure[] {
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      reason: String(row.info ?? row.type ?? row.reason ?? ''),
      streetName: String(row.street ?? row.street_name ?? ''),
      fromStreet: String(row.from_st ?? row.from_street ?? ''),
      toStreet: String(row.to_st ?? row.to_street ?? ''),
      startDate: String(row.start_dt ?? row.start_date ?? ''),
      endDate: String(row.end_dt ?? row.end_date ?? ''),
    };
  }).filter((c) => c.streetName);
}

async function ingestCitySfStreetClosures(
  cityId: string,
  appToken: string | undefined,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const rows = await fetchClosures(appToken);
  const closures = parseClosures(rows);

  const data: SfStreetClosuresData = {
    closures,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.sfStreetClosures(cityId), data, TTL_SECONDS);
  if (db) await saveSfStreetClosures(db, cityId, data);
  log.info(`${cityId}: ${closures.length} active street closures`);
}

export function createSfStreetClosuresIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestSfStreetClosures(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (city.country !== 'US') continue;
      try {
        await ingestCitySfStreetClosures(city.id, city.dataSources.sfSocrata?.appToken, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
