import type { HmisSubdistrictSummary, HmisSubdistrictRow } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveHmisSubdistrict } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-hmis-subdistrict');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 86_400;

interface HmisRow {
  indicator?: string;
  parameters?: string;
  type?: string;
  [key: string]: unknown;
}

function normalizeSubdistrictKey(key: string): string {
  return key
    .replace(/^subdistrict_+/, '')
    .replace(/__+/g, '_')
    .replace(/_+$/g, '')
    .replace(/_/g, ' ')
    .trim();
}

function parseIntSafe(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = parseInt(value.replace(/,/g, '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function pickMetric(row: HmisRow): keyof HmisSubdistrictRow['metrics'] | null {
  const p = (row.parameters ?? '').toLowerCase();
  if (p.includes('total number of pregnant women registered for anc')) return 'pregnantRegistered';
  if (p.includes('registered within first trimester')) return 'firstTrimesterRegistered';
  if (p.includes('registered under jsy')) return 'jsyRegistered';
  return null;
}

export function parseHmisRows(resourceId: string, rows: HmisRow[]): HmisSubdistrictSummary {
  const map = new Map<string, HmisSubdistrictRow>();

  for (const row of rows) {
    // Keep only total rows to avoid rural/urban splits and duplicates.
    const rowType = (row.type ?? '').toString().toUpperCase();
    if (rowType !== 'TOTAL') continue;

    const metric = pickMetric(row);
    if (!metric) continue;

    for (const [key, raw] of Object.entries(row)) {
      if (!key.startsWith('subdistrict_')) continue;
      const name = normalizeSubdistrictKey(key);
      if (!name) continue;

      const current = map.get(name) ?? {
        name,
        metrics: {
          pregnantRegistered: 0,
          firstTrimesterRegistered: 0,
          jsyRegistered: 0,
        },
      };

      current.metrics[metric] = parseIntSafe(raw);
      map.set(name, current);
    }
  }

  const rowsSorted = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    sourceResourceId: resourceId,
    rows: rowsSorted,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchRows(resourceId: string, apiKey: string): Promise<HmisRow[]> {
  const url = new URL(`${DATA_GOV_IN_BASE}/${resourceId}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '500');

  const response = await log.fetch(url.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = await response.json() as { status?: string; records?: HmisRow[]; message?: string };
  if (json.status === 'error') {
    throw new Error(json.message ?? 'data.gov.in returned error status');
  }
  return Array.isArray(json.records) ? json.records : [];
}

export function createHmisSubdistrictIngestion(cache: Cache, db: Db | null = null) {
  const apiKey = process.env.DATA_GOV_IN_API_KEY ?? '';

  return async function ingestHmisSubdistrict(): Promise<void> {
    if (!apiKey) {
      log.warn('DATA_GOV_IN_API_KEY not set - skipping HMIS ingestion');
      return;
    }

    for (const city of getActiveCities()) {
      const cfg = city.dataSources.hmisSubdistrict;
      if (!cfg) continue;

      try {
        const rows = await fetchRows(cfg.resourceId, apiKey);
        if (rows.length === 0) {
          log.info(`${city.id}: no HMIS rows`);
          continue;
        }

        const summary = parseHmisRows(cfg.resourceId, rows);
        cache.set(CK.hmisSubdistrict(city.id), summary, TTL_SECONDS);

        if (db) {
          try {
            await saveHmisSubdistrict(db, city.id, summary);
          } catch (err) {
            log.error(`${city.id} DB write failed`, err);
          }
        }

        log.info(`${city.id}: HMIS subdistrict rows ${summary.rows.length}`);
      } catch (err) {
        log.error(`${city.id} HMIS ingestion failed`, err);
      }
    }
  };
}
