import type { MsmeSummary, MsmeEnterprise, MsmeActivity, MsmeSectorCount } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMsme } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-msme');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/8b68ae56-84cf-4728-a0a6-1be11028dea7';
const FETCH_TIMEOUT_MS = 30_000;
const TTL_SECONDS = 86400; // 24 hours (updated daily)
const PAGE_SIZE = 1000;
const RECENT_LIMIT = 10;
const TOP_SECTORS_LIMIT = 10;

interface MsmeRow {
  LG_ST_Code?: number;
  State?: string;
  LG_DT_Code?: number;
  District?: string;
  Pincode?: string;
  RegistrationDate?: string;
  EnterpriseName?: string;
  CommunicationAddress?: string;
  Activities?: string;
}

interface NicActivity {
  NIC5DigitId?: string;
  Description?: string;
}

function parseActivities(raw: string | undefined): MsmeActivity[] {
  if (!raw) return [];
  try {
    const parsed: NicActivity[] = JSON.parse(raw);
    return parsed
      .filter((a) => a.NIC5DigitId && a.Description)
      .map((a) => ({ nicCode: a.NIC5DigitId!, description: a.Description! }));
  } catch {
    return [];
  }
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Format: "DD/MM/YYYY"
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(`${yyyy}-${mm}-${dd}`);
  return isNaN(d.getTime()) ? null : d;
}

function rowToEnterprise(row: MsmeRow): MsmeEnterprise {
  return {
    name: (row.EnterpriseName ?? '').trim(),
    district: (row.District ?? '').trim(),
    state: (row.State ?? '').trim(),
    pincode: (row.Pincode ?? '').trim(),
    registrationDate: (row.RegistrationDate ?? '').trim(),
    activities: parseActivities(row.Activities),
  };
}

async function fetchPage(
  districtName: string,
  apiKey: string,
  offset: number,
  limit: number,
): Promise<{ records: MsmeRow[]; total: number }> {
  const url = new URL(DATA_GOV_IN_BASE);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('filters[District]', districtName);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { status?: string; total?: number; records?: MsmeRow[] };
    if (json.status === 'error') throw new Error('API error response');
    return { records: json.records ?? [], total: json.total ?? 0 };
  } finally {
    clearTimeout(timer);
  }
}

export function buildMsmeSummary(rows: MsmeRow[]): Omit<MsmeSummary, 'fetchedAt'> {
  // Sort by date descending for recent registrations
  const withDates = rows.map((r) => ({ row: r, date: parseDate(r.RegistrationDate) }));
  withDates.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });

  const recentRegistrations: MsmeEnterprise[] = withDates
    .slice(0, RECENT_LIMIT)
    .map(({ row }) => rowToEnterprise(row));

  // Aggregate sector counts from Activities
  const sectorMap = new Map<string, number>();
  for (const row of rows) {
    const activities = parseActivities(row.Activities);
    const seen = new Set<string>();
    for (const a of activities) {
      if (!seen.has(a.description)) {
        seen.add(a.description);
        sectorMap.set(a.description, (sectorMap.get(a.description) ?? 0) + 1);
      }
    }
  }

  const topSectors: MsmeSectorCount[] = [...sectorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SECTORS_LIMIT)
    .map(([description, count]) => ({ description, count }));

  return {
    totalRegistered: rows.length,
    recentRegistrations,
    topSectors,
  };
}

async function ingestCity(cityId: string, districtName: string, apiKey: string, cache: Cache, db: Db | null) {
  log.info(`${cityId}: fetching MSME UDYAM for district ${districtName}`);

  // Fetch first page to get total
  const first = await fetchPage(districtName, apiKey, 0, PAGE_SIZE);
  const total = first.total;

  if (total === 0) {
    log.warn(`${cityId}: no MSME records for district ${districtName}`);
    return;
  }

  let allRows: MsmeRow[] = [...first.records];

  // Fetch remaining pages (cap at 50 pages = 50,000 records to avoid abuse)
  const maxPages = Math.min(Math.ceil(total / PAGE_SIZE), 50);
  for (let page = 1; page < maxPages; page++) {
    const { records } = await fetchPage(districtName, apiKey, page * PAGE_SIZE, PAGE_SIZE);
    allRows = allRows.concat(records);
  }

  log.info(`${cityId}: fetched ${allRows.length} of ${total} MSME records`);

  const summary: MsmeSummary = {
    ...buildMsmeSummary(allRows),
    totalRegistered: total, // use API total rather than fetched count
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.msme(cityId), summary, TTL_SECONDS);

  if (db) {
    try {
      await saveMsme(db, cityId, summary);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: ${total} MSMEs, ${summary.topSectors.length} sectors`);
}

export function createMsmeIngestion(cache: Cache, db: Db | null) {
  const apiKey = process.env.DATA_GOV_IN_API_KEY ?? '';
  const cities = getActiveCities();

  return async function ingestMsme() {
    for (const city of cities) {
      const cfg = city.dataSources.msme;
      if (!cfg) continue;
      try {
        await ingestCity(city.id, cfg.districtName, apiKey, cache, db);
      } catch (err) {
        log.error(`${city.id} ingestion failed`, err);
      }
    }
  };
}
