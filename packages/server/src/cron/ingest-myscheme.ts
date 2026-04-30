import type { SchemeCatalogue, SchemeEntry } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveMyScheme } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-myscheme');

const MYSCHEME_BASE = 'https://api.myscheme.gov.in/search/v4/schemes';
// Required by AWS API Gateway — requests without Origin are rejected
const MYSCHEME_ORIGIN = 'https://www.myscheme.gov.in';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 86400; // 1 day
const PAGE_SIZE = 30;

interface MySchemeHitFields {
  schemeName?: string;
  schemeShortTitle?: string;
  briefDescription?: string;
  nodalMinistryName?: string;
  schemeCategory?: string[];
  beneficiaryState?: string[];
  tags?: string[];
  slug?: string;
}

interface MySchemeHit {
  id?: string;
  fields?: MySchemeHitFields;
}

interface MySchemeApiResponse {
  data?: {
    summary?: { total?: number };
    hits?: { items?: MySchemeHit[] };
  };
}

function mapScheme(hit: MySchemeHit): SchemeEntry | null {
  const f = hit.fields;
  if (!f) return null;
  const id = hit.id ?? f.slug ?? '';
  const name = f.schemeName ?? f.schemeShortTitle ?? '';
  if (!id || !name) return null;
  return {
    id,
    name,
    ministry: f.nodalMinistryName ?? '',
    benefitType: (f.schemeCategory ?? []).join(', '),
    description: f.briefDescription ?? '',
    applyUrl: f.slug
      ? `https://www.myscheme.gov.in/schemes/${f.slug}`
      : 'https://www.myscheme.gov.in',
    tags: Array.isArray(f.tags) ? f.tags : [],
  };
}

export function createMySchemeIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestMyScheme(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.myScheme) continue;
      try {
        await ingestCityMyScheme(city.id, city.dataSources.myScheme.stateName, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityMyScheme(
  cityId: string,
  stateName: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  // Filter param is a JSON array: [{"identifier":"beneficiaryState","value":"<StateName>"}]
  const q = JSON.stringify([{ identifier: 'beneficiaryState', value: stateName }]);

  const params = new URLSearchParams({
    lang: 'en',
    q,
    numberOfSchemes: String(PAGE_SIZE),
    pageNumber: '1',
  });

  const url = `${MYSCHEME_BASE}?${params}`;
  const response = await log.fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      Origin: MYSCHEME_ORIGIN,
    },
  });

  if (!response.ok) {
    log.warn(`${cityId}: MyScheme API returned ${response.status}`);
    return;
  }

  const json = await response.json() as MySchemeApiResponse;
  const rawHits: MySchemeHit[] = json.data?.hits?.items ?? [];
  const totalCount = json.data?.summary?.total ?? rawHits.length;

  if (rawHits.length === 0) {
    log.info(`${cityId}: no schemes returned`);
    return;
  }

  const schemes: SchemeEntry[] = rawHits
    .map(mapScheme)
    .filter((s): s is SchemeEntry => s !== null);

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

  log.info(`${cityId}: ${schemes.length} schemes (${totalCount} total for ${stateName})`);
}
