/**
 * SF Safety ingestor — combines SFGOV Socrata datasets:
 *  - gnap-fj3t: Law Enforcement Dispatched Calls (last 24h)
 *  - nuek-vuh3: Fire Department Dispatched Calls (last 24h)
 *
 * Runs every 10 minutes. SF-only (country === 'US').
 */
import type { SfSafetyData, SfDispatchCall, SfFireEmsCall } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSfSafety } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-sf-safety');

const TTL_SECONDS = 600; // 10 min
const FETCH_TIMEOUT_MS = 20_000;
const LIMIT = 500;

const LAW_ENFORCEMENT_URL = 'https://data.sfgov.org/resource/gnap-fj3t.json';
const FIRE_EMS_URL = 'https://data.sfgov.org/resource/nuek-vuh3.json';

async function fetchSocrata(
  url: string,
  appToken: string | undefined,
  dtField = 'received_dttm',
): Promise<unknown[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace('Z', '');
  const params = new URLSearchParams({
    $limit: String(LIMIT),
    $order: `${dtField} DESC`,
    $where: `${dtField} > '${since}'`,
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'CityMonitor/1.0',
  };
  if (appToken) headers['X-App-Token'] = appToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}?${params}`, { headers, signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as unknown[];
  } finally {
    clearTimeout(timer);
  }
}

function parseLawEnforcement(rows: unknown[]): SfDispatchCall[] {
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      callType: String(row.call_type_final_desc ?? row.call_type_original_desc ?? ''),
      priority: String(row.priority_final ?? row.priority_original ?? ''),
      disposition: String(row.disposition ?? ''),
      address: String(row.address ?? ''),
      district: String(row.supervisor_district ?? row.analysis_neighborhood ?? ''),
      createdAt: String(row.received_datetime ?? row.entry_datetime ?? ''),  // gnap-fj3t uses received_datetime
    };
  }).filter((c) => c.createdAt);
}

function parseFireEms(rows: unknown[]): SfFireEmsCall[] {
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      callType: String(row.call_type ?? row.call_type_final_desc ?? ''),
      callNumber: String(row.call_number ?? ''),
      address: String(row.address ?? ''),
      neighborhood: String(row.neighborhoods_analysis_boundaries ?? row.neighborhood_district ?? ''),  // nuek-vuh3 field
      receivedDtTm: String(row.received_dttm ?? ''),
    };
  }).filter((c) => c.receivedDtTm);
}

async function ingestCitySfSafety(
  cityId: string,
  appToken: string | undefined,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const [lawRows, fireRows] = await Promise.all([
    fetchSocrata(LAW_ENFORCEMENT_URL, appToken, 'received_datetime').catch((err) => {
      log.warn(`${cityId}: law enforcement fetch failed — ${(err as Error).message}`);
      return [] as unknown[];
    }),
    fetchSocrata(FIRE_EMS_URL, appToken).catch((err) => {
      log.warn(`${cityId}: fire/EMS fetch failed — ${(err as Error).message}`);
      return [] as unknown[];
    }),
  ]);

  const data: SfSafetyData = {
    lawEnforcement: parseLawEnforcement(lawRows),
    fireEms: parseFireEms(fireRows),
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.sfSafety(cityId), data, TTL_SECONDS);
  if (db) await saveSfSafety(db, cityId, data);
  log.info(`${cityId}: ${data.lawEnforcement.length} law enforcement, ${data.fireEms.length} fire/EMS calls`);
}

export function createSfSafetyIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestSfSafety(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (city.country !== 'US') continue;
      try {
        await ingestCitySfSafety(city.id, city.dataSources.sfSocrata?.appToken, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
