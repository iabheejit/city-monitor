/**
 * SF 311 Service Requests ingestor — SFGOV Socrata dataset vw6y-z8j6.
 * Fetches requests from the last 7 days, returns top categories + total.
 * Schedule: nightly (daily lag is expected for this dataset).
 */
import type { Sf311Data, Sf311Request } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSf311 } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-sf311');

const TTL_SECONDS = 86_400; // 24h
const FETCH_TIMEOUT_MS = 20_000;
const LIMIT = 1000;
const BASE_URL = 'https://data.sfgov.org/resource/vw6y-z8j6.json';

async function fetchSf311(appToken: string | undefined): Promise<unknown[]> {
  const since = new Date(Date.now() - 7 * 86_400 * 1000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    $limit: String(LIMIT),
    $order: 'requested_datetime DESC',
    $where: `requested_datetime >= '${since}'`,
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

function parse311Rows(rows: unknown[]): Sf311Request[] {
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      category: String(row.service_name ?? row.request_type ?? ''),
      status: String(row.status ?? ''),
      address: String(row.address ?? ''),
      neighborhood: String(row.neighborhoods_sffind_boundaries ?? row.police_district ?? ''),
      opened: String(row.requested_datetime ?? ''),
    };
  }).filter((r) => r.category && r.opened);
}

async function ingestCitySf311(
  cityId: string,
  appToken: string | undefined,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const rows = await fetchSf311(appToken);
  const requests = parse311Rows(rows);

  const data: Sf311Data = {
    requests,
    totalCount: requests.length,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.sf311(cityId), data, TTL_SECONDS);
  if (db) await saveSf311(db, cityId, data);
  log.info(`${cityId}: ${requests.length} 311 service requests`);
}

export function createSf311Ingestion(cache: Cache, db: Db | null = null) {
  return async function ingestSf311(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (city.country !== 'US') continue;
      try {
        await ingestCitySf311(city.id, city.dataSources.sfSocrata?.appToken, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
