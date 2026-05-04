import type { JjmSummary } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveJjm } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-jjm');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource';
const FETCH_TIMEOUT_MS = 30_000;
const TTL_SECONDS = 7 * 86400; // 7 days

const PAGE_SIZE = 1000;

interface JjmApiRecord {
  state_name?: string;
  district_name?: string;
  block_name?: string;
  panchayat_name?: string;
  village_name?: string;
  habitation_name?: string;
  habitation_id?: string;
  scheme_id?: string;
}

export function aggregateJjmRecords(records: JjmApiRecord[]): JjmSummary {
  const blocks = new Set<string>();
  const panchayats = new Set<string>();
  const villages = new Set<string>();

  for (const r of records) {
    if (r.block_name) blocks.add(r.block_name);
    if (r.panchayat_name) panchayats.add(`${r.block_name ?? ''}|${r.panchayat_name}`);
    if (r.village_name) villages.add(`${r.block_name ?? ''}|${r.village_name}`);
  }

  return {
    totalHabitations: records.length,
    totalBlocks: blocks.size,
    totalPanchayats: panchayats.size,
    totalVillages: villages.size,
    blocks: [...blocks].sort(),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchAllPages(
  resourceId: string,
  apiKey: string,
  stateName: string,
  districtName: string,
): Promise<JjmApiRecord[]> {
  const all: JjmApiRecord[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      'api-key': apiKey,
      format: 'json',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      'filters[state_name]': stateName,
      'filters[district_name]': districtName,
    });

    const url = `${DATA_GOV_IN_BASE}/${resourceId}?${params}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

    if (!response.ok) {
      throw new Error(`JJM API returned ${response.status}`);
    }

    const json = await response.json() as { records?: JjmApiRecord[]; total?: number };
    const records: JjmApiRecord[] = Array.isArray(json.records) ? json.records : [];
    all.push(...records);

    const total = json.total ?? 0;
    offset += PAGE_SIZE;
    if (offset >= total || records.length < PAGE_SIZE) break;
  }

  return all;
}

export function createJjmIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestJjm(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.jjm) continue;
      const { resourceId, stateName, districtName } = city.dataSources.jjm;

      const apiKey = process.env.DATA_GOV_IN_API_KEY;
      if (!apiKey) {
        log.warn(`${city.id}: DATA_GOV_IN_API_KEY not set — skipping JJM ingestion`);
        continue;
      }

      try {
        log.info(`${city.id}: fetching JJM habitations`);
        const records = await fetchAllPages(resourceId, apiKey, stateName, districtName);

        if (records.length === 0) {
          log.info(`${city.id}: no JJM records`);
          continue;
        }

        const summary = aggregateJjmRecords(records);
        cache.set(CK.jjm(city.id), summary, TTL_SECONDS);

        if (db) {
          try {
            await saveJjm(db, city.id, summary);
          } catch (err) {
            log.error(`${city.id} DB write failed`, err);
          }
        }

        log.info(
          `${city.id}: JJM — ${summary.totalHabitations} habitations, ${summary.totalBlocks} blocks, ${summary.totalVillages} villages`,
        );
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
