import type { MgnregaSummary } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMgnrega } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-mgnrega');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/9802de1b-1be5-4c1c-b247-aba9ee9b25d9';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 86400; // 1 day

interface MgnregaRecord {
  State_name?: string;
  District_Name?: string;
  Financial_Year?: string;
  Approved_Labour_Budget?: string;
  Total_Person_Days_Generated?: string;
  Total_Households_Registered?: string;
  Active_Workers?: string;
  Total_Exp_Rs_In_Lakhs?: string;
  Centre_Released_Fund_In_Lakhs?: string;
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

function derivedReportMonth(financialYear: string): string {
  // MGNREGA uses fiscal year format like "2024-2025"; report as Apr of start year
  const match = financialYear.match(/^(\d{4})/);
  return match ? `${match[1]}-04` : financialYear;
}

export function parseMgnregaRecord(record: MgnregaRecord): MgnregaSummary | null {
  const fy = (record.Financial_Year ?? '').trim();
  if (!fy) return null;

  return {
    financialYear: fy,
    personDaysGenerated: parseLong(record.Total_Person_Days_Generated),
    jobCardsIssued: parseLong(record.Total_Households_Registered),
    activeWorkers: parseLong(record.Active_Workers),
    amountSpent: parseLakhsToRupees(record.Total_Exp_Rs_In_Lakhs),
    totalSanctioned: parseLakhsToRupees(record.Centre_Released_Fund_In_Lakhs),
    reportMonth: derivedReportMonth(fy),
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
    'filters[State_name]': stateName,
    'filters[District_Name]': districtName,
    limit: '5',
    'sort[Financial_Year]': 'desc',
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
