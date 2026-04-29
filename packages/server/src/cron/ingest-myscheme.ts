import type { SchemeCatalogue, SchemeEntry } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMyScheme } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-myscheme');

const MYSCHEME_BASE = 'https://api.myscheme.gov.in/search/v4/schemes';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 86400; // 1 day
const PAGE_SIZE = 30;

interface MySchemeApiScheme {
  schemeId?: string;
  schemeName?: string;
  schemeShortTitle?: string;
  schemeDescription?: string;
  benefit?: { benefitType?: string };
  ministry?: { nameEn?: string };
  applicationProcess?: Array<{ stepEn?: string }>;
  schemeUrl?: string;
  tags?: string[];
}

interface MySchemeApiResponse {
  data?: {
    schemes?: MySchemeApiScheme[];
    totalSchemes?: number;
  };
}

function mapScheme(raw: MySchemeApiScheme): SchemeEntry {
  return {
    id: raw.schemeId ?? '',
    name: raw.schemeName ?? raw.schemeShortTitle ?? '',
    ministry: raw.ministry?.nameEn ?? '',
    benefitType: raw.benefit?.benefitType ?? '',
    description: raw.schemeDescription ?? '',
    applyUrl: raw.schemeUrl ?? 'https://www.myscheme.gov.in',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

export function createMySchemeIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestMyScheme(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.myScheme) continue;
      try {
        await ingestCityMyScheme(city.id, city.dataSources.myScheme.stateCode, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityMyScheme(
  cityId: string,
  stateCode: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const params = new URLSearchParams({
    lang: 'en',
    beneficiaryState: stateCode,
    numberOfSchemes: String(PAGE_SIZE),
    pageNumber: '1',
  });

  const url = `${MYSCHEME_BASE}?${params}`;
  const response = await log.fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    log.warn(`${cityId}: MyScheme API returned ${response.status}`);
    return;
  }

  const json = await response.json() as MySchemeApiResponse;
  const rawSchemes: MySchemeApiScheme[] = Array.isArray(json.data?.schemes) ? json.data!.schemes! : [];
  const totalCount = json.data?.totalSchemes ?? rawSchemes.length;

  if (rawSchemes.length === 0) {
    log.info(`${cityId}: no schemes returned`);
    return;
  }

  const schemes: SchemeEntry[] = rawSchemes
    .map(mapScheme)
    .filter((s) => s.id && s.name);

  const catalogue: SchemeCatalogue = {
    schemes,
    totalCount,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.myScheme(cityId), catalogue, TTL_SECONDS);

  if (db) {
    try {
      await saveMyScheme(db, cityId, catalogue);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: ${schemes.length} schemes (${totalCount} total for ${stateCode})`);
}
