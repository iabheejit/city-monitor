import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSafetyReports } from '../db/writes.js';
import { loadSafetyCoords } from '../db/reads.js';
import { parseFeed } from '../lib/rss-parser.js';
import { hashString } from '../lib/hash.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';
import { geolocateReports } from '../lib/openai.js';

const log = createLogger('ingest-safety');

export interface SafetyReport {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
  district?: string;
  location?: { lat: number; lon: number; label?: string };
}

const SAFETY_TIMEOUT_MS = 10_000;

export function createSafetyIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestSafety(): Promise<void> {
    const eligible = getActiveCities().filter((city) => city.dataSources.police);
    const results = await Promise.allSettled(
      eligible.map((city) =>
        ingestCitySafety(city.id, city.name, city.dataSources.police!, cache, db),
      ),
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        log.error(`${eligible[i].id} failed`, r.reason);
      }
    }
  };
}

async function ingestCitySafety(cityId: string, cityName: string, policeConfig: { url: string; districts?: string[] }, cache: Cache, db: Db | null): Promise<void> {
  const response = await log.fetch(policeConfig.url, {
    signal: AbortSignal.timeout(SAFETY_TIMEOUT_MS),
    headers: { 'User-Agent': 'CityMonitor/1.0' },
  });

  if (!response.ok) return;

  const xml = await response.text();
  const items = parseFeed(xml);

  const reports: SafetyReport[] = items.map((item) => ({
    id: hashString(item.url + item.title),
    title: item.title,
    description: item.description || '',
    publishedAt: item.publishedAt,
    url: item.url,
    district: extractDistrict(item.title, policeConfig.districts),
  }));

  // Carry over coordinates from DB for already-geocoded items
  const hashes = reports.map((r) => r.id);
  let existingCoords = new Map<string, SafetyReport['location']>();
  if (db) {
    try {
      existingCoords = await loadSafetyCoords(db, cityId, hashes);
    } catch {
      // DB read failed — geocode everything fresh
    }
  }

  for (const report of reports) {
    const stored = existingCoords.get(report.id);
    if (stored) report.location = stored;
  }

  // LLM geolocation only for items without coordinates
  const needsGeo = reports.filter((r) => !r.location);
  if (needsGeo.length > 0) {
    try {
      const geoResults = await geolocateReports(
        cityId,
        cityName,
        needsGeo.map((r) => ({ title: r.title, description: r.description })),
      );
      if (geoResults) {
        for (const geo of geoResults) {
          if (geo.lat != null && geo.lon != null && needsGeo[geo.index]) {
            needsGeo[geo.index].location = { lat: geo.lat, lon: geo.lon, label: geo.locationLabel };
          }
        }
      }
    } catch {
      log.warn(`${cityId} geolocation failed, continuing without`);
    }
  }

  // Sort by most recent first
  reports.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  cache.set(CK.safetyRecent(cityId), reports, 900);

  if (db) {
    try {
      await saveSafetyReports(db, cityId, reports);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId}: ${reports.length} reports`);
}

function extractDistrict(title: string, districts?: string[]): string | undefined {
  if (!districts) return undefined;
  for (const district of districts) {
    if (title.includes(district)) return district;
  }
  return undefined;
}
