import type { MandiSummary, MandiCommodity } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMandi } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-mandi');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const FETCH_TIMEOUT_MS = 15_000;
const TTL_SECONDS = 43200; // 12h

// Field names use '_x0020_' as URL-encoded space (hex entity from the AGMARKNET API's
// underlying XML schema). These are the literal keys returned by the data.gov.in API.
interface AgmarknetRecord {
  State?: string;
  District?: string;
  Market?: string;
  Commodity?: string;
  Variety?: string;
  Grade?: string;
  Arrival_Date?: string;
  Min_x0020_Price?: string;
  Max_x0020_Price?: string;
  Modal_x0020_Price?: string;
}

function parsePrice(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseAgmarknetRecords(records: AgmarknetRecord[]): MandiCommodity[] {
  // Group by commodity name, keep the record with the latest arrival date
  const latest = new Map<string, AgmarknetRecord>();
  for (const r of records) {
    const key = (r.Commodity ?? '').toLowerCase();
    if (!key) continue;
    const existing = latest.get(key);
    if (!existing || (r.Arrival_Date ?? '') > (existing.Arrival_Date ?? '')) {
      latest.set(key, r);
    }
  }

  return [...latest.values()]
    .map((r) => ({
      name: r.Commodity ?? '',
      variety: r.Variety ?? '',
      market: r.Market ?? '',
      modalPrice: parsePrice(r.Modal_x0020_Price),
      minPrice: parsePrice(r.Min_x0020_Price),
      maxPrice: parsePrice(r.Max_x0020_Price),
      arrivalDate: r.Arrival_Date ?? '',
    }))
    .filter((c) => c.name && c.modalPrice > 0)
    .sort((a, b) => b.modalPrice - a.modalPrice);
}

export function createMandiIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestMandi(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.agmarknet) continue;
      try {
        await ingestCityMandi(city.id, city.dataSources.agmarknet.stateId, city.dataSources.agmarknet.districtName, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityMandi(
  cityId: string,
  stateId: string,
  districtName: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    log.warn(`${cityId}: DATA_GOV_IN_API_KEY not set — skipping mandi ingestion`);
    return;
  }

  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    'filters[State]': stateId,
    'filters[District]': districtName,
    limit: '100',
    'sort[Arrival_Date]': 'desc',
  });

  const url = `${DATA_GOV_IN_BASE}?${params}`;
  const response = await log.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    log.warn(`${cityId}: AGMARKNET returned ${response.status}`);
    return;
  }

  const json = await response.json() as { records?: AgmarknetRecord[]; total?: number };
  const records: AgmarknetRecord[] = Array.isArray(json.records) ? json.records : [];

  if (records.length === 0) {
    log.info(`${cityId}: no mandi records`);
    return;
  }

  const commodities = parseAgmarknetRecords(records);
  const summary: MandiSummary = {
    commodities,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.mandi(cityId), summary, TTL_SECONDS);

  if (db) {
    try {
      await saveMandi(db, cityId, summary);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: ${commodities.length} commodities`);
}

export { parseAgmarknetRecords };
