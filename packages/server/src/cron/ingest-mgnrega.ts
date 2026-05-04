import type { MgnregaSummary } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMgnrega } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-mgnrega');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 86400; // 1 day

interface MgnregaRecord {
  state_name?: string;
  district_name?: string;
  fin_year?: string;
  month?: string;
  Approved_Labour_Budget?: string;
  Total_Households_Worked?: string;
  Total_No_of_Active_Workers?: string;
  Total_No_of_JobCards_issued?: string;
  Persondays_of_Central_Liability_so_far?: string;
  Total_Exp?: string; // lakhs
  Wages?: string; // lakhs (wage component only)
  Women_Persondays?: string;
  SC_persondays?: string;
  ST_persondays?: string;
}

function parseLakhsToRupees(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/,/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100_000); // convert lakhs to rupees
}

function parseLong(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/,/g, ''));
  return isNaN(n) ? 0 : Math.round(n);
}


export function parseMgnregaRecord(record: MgnregaRecord): MgnregaSummary | null {
  const fy = (record.fin_year ?? '').trim();
  if (!fy) return null;

  const month = (record.month ?? '').trim();
  // Build reportMonth as YYYY-MM from fin_year + month name
  const monthMap: Record<string, string> = {
    April:'04',May:'05',June:'06',July:'07',August:'08',September:'09',
    October:'10',November:'11',December:'12',January:'01',February:'02',March:'03',
  };
  const fyYear = fy.match(/^(\d{4})/)?.[1] ?? fy.slice(0, 4);
  const monthNum = monthMap[month];
  const reportMonth = monthNum
    ? `${parseInt(monthNum) >= 4 ? fyYear : String(parseInt(fyYear) + 1)}-${monthNum}`
    : `${fyYear}-04`;

  return {
    financialYear: fy,
    personDaysGenerated: parseLong(record.Persondays_of_Central_Liability_so_far),
    jobCardsIssued: parseLong(record.Total_No_of_JobCards_issued),
    activeWorkers: parseLong(record.Total_No_of_Active_Workers),
    amountSpent: parseLakhsToRupees(record.Wages ?? record.Total_Exp),
    totalSanctioned: parseLong(record.Approved_Labour_Budget),
    reportMonth,
    fetchedAt: new Date().toISOString(),
  };
}

export function createMgnregaIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestMgnrega(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.mgnrega) continue;
      try {
        await ingestCityMgnrega(
          city.id,
          city.dataSources.mgnrega.stateName,
          city.dataSources.mgnrega.districtName,
          cache,
          db,
        );
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityMgnrega(
  cityId: string,
  stateName: string,
  districtName: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    log.warn(`${cityId}: DATA_GOV_IN_API_KEY not set — skipping MGNREGA ingestion`);
    return;
  }

  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    'filters[state_name]': stateName,
    'filters[district_name]': districtName,
    limit: '5',
    'sort[fin_year]': 'desc',
  });

  const url = `${DATA_GOV_IN_BASE}?${params}`;
  const response = await log.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    log.warn(`${cityId}: MGNREGA API returned ${response.status}`);
    return;
  }

  const json = await response.json() as { records?: MgnregaRecord[] };
  const records: MgnregaRecord[] = Array.isArray(json.records) ? json.records : [];

  if (records.length === 0) {
    log.info(`${cityId}: no MGNREGA records`);
    return;
  }

  // Use the most recent financial year record
  const record = records[0];
  const summary = parseMgnregaRecord(record);
  if (!summary) {
    log.warn(`${cityId}: failed to parse MGNREGA record`);
    return;
  }

  cache.set(CK.mgnrega(cityId), summary, TTL_SECONDS);

  if (db) {
    try {
      await saveMgnrega(db, cityId, summary);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: MGNREGA FY ${summary.financialYear} — ${summary.personDaysGenerated} person-days`);
}
