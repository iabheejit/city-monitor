import type { Nfhs5Summary } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveNfhs5 } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-nfhs5');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/cf80173e-fece-439d-a0b1-6e9cb510593d';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 30 * 86400; // 30 days — survey data changes rarely

interface Nfhs5ApiRecord {
  District_Names?: string;
  State_UT?: string;
  Institutional_Birth?: string | number;
  Children_Fully_Vaccinated?: string | number;
  Stunted_Children_Under_Five?: string | number;
  Wasted_Children_Under_Five?: string | number;
  Underweight_Children_Under_Five?: string | number;
  Anaemic_Non_Pregnant_Women?: string | number;
  Anaemic_Children_6_59_Months?: string | number;
  Improved_Drinking_Water_Source?: string | number;
  Household_Using_Improved_Sanitation?: string | number;
  Households_Using_Clean_Fuel?: string | number;
  Men_Tobacco?: string | number;
  Women_Tobacco?: string | number;
  Women_High_Blood_Sugar?: string | number;
  Men_High_Blood_Sugar?: string | number;
  Sex_Ratio?: string | number;
  // The actual API uses slightly different field names:
  [key: string]: string | number | undefined;
}

function parseNum(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '*' || val === '-') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

export function parseNfhs5Record(record: Nfhs5ApiRecord): Nfhs5Summary {
  // Field names from the actual API (confirmed via probe):
  return {
    institutionalBirths: parseNum(record['Institutional_Birth']),
    childFullyVaccinated: parseNum(record['Children_Fully_Vaccinated']),
    stuntedUnderFive: parseNum(record['Stunted_Children_Under_Five']),
    wastedUnderFive: parseNum(record['Wasted_Children_Under_Five']),
    underweightUnderFive: parseNum(record['Underweight_Children_Under_Five']),
    anaemicWomen: parseNum(record['Anaemic_Non-Pregnant_Women']),
    anaemicChildren: parseNum(record['Anaemic_Children_6-59_Months']),
    improvedDrinkingWater: parseNum(record['Improved_Drinking-Water_Source']),
    improvedSanitation: parseNum(record['Household_Using_Improved_Sanitation']),
    cleanFuel: parseNum(record['Households_Using_Clean_Fuel']),
    tobaccoMen: parseNum(record['Men_Tobacco']),
    tobaccoWomen: parseNum(record['Women_Tobacco']),
    highBloodSugarWomen: parseNum(record['Women_High_Blood_Sugar']),
    highBloodSugarMen: parseNum(record['Men_High_Blood_Sugar']),
    sexRatio: parseNum(record['Sex_Ratio']),
    surveyRound: 'NFHS-5 (2019-21)',
    fetchedAt: new Date().toISOString(),
  };
}

async function ingestCityNfhs5(
  cityId: string,
  resourceId: string,
  districtFilter: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    log.warn(`${cityId}: DATA_GOV_IN_API_KEY not set — skipping NFHS-5 ingestion`);
    return;
  }

  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    [`filters[District_Names]`]: districtFilter,
    limit: '1',
  });

  const url = `${DATA_GOV_IN_BASE}?${params}`;
  const response = await log.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    log.warn(`${cityId}: NFHS-5 API returned ${response.status}`);
    return;
  }

  const json = await response.json() as { records?: Nfhs5ApiRecord[]; total?: number };
  const records: Nfhs5ApiRecord[] = Array.isArray(json.records) ? json.records : [];

  if (records.length === 0) {
    log.info(`${cityId}: no NFHS-5 records for district "${districtFilter}"`);
    return;
  }

  const summary = parseNfhs5Record(records[0]);
  cache.set(CK.nfhs5(cityId), summary, TTL_SECONDS);

  if (db) {
    try {
      await saveNfhs5(db, cityId, summary);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: NFHS-5 ingested — institutional births ${summary.institutionalBirths}%`);
}

export function createNfhs5Ingestion(cache: Cache, db: Db | null = null) {
  return async function ingestNfhs5(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.nfhs5) continue;
      try {
        await ingestCityNfhs5(
          city.id,
          city.dataSources.nfhs5.resourceId,
          city.dataSources.nfhs5.districtFilter,
          cache,
          db,
        );
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
