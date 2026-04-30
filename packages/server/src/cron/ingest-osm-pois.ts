import type { OsmPoi, OsmPoiCollection } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveOsmPois } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-osm-pois');

const FETCH_TIMEOUT_MS = 60_000;
const POIS_TTL_SECONDS = 14 * 86400;

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  remark?: string;
}

const TARGET_AMENITIES = ['hospital', 'clinic', 'school', 'university', 'fire_station', 'police'] as const;

export function buildOverpassQuery(areaName: string): string {
  const amenities = TARGET_AMENITIES.join('|');
  return `[out:json][timeout:50];
area["name"="${areaName}"]["boundary"="administrative"]->.s;
(
  node["amenity"~"^(${amenities})$"](area.s);
  way["amenity"~"^(${amenities})$"](area.s);
  node["leisure"="park"](area.s);
  way["leisure"="park"](area.s);
);
out center tags;`;
}

export function parseOverpassResponse(elements: OverpassElement[]): OsmPoi[] {
  const pois: OsmPoi[] = [];
  for (const el of elements) {
    if (el.type === 'relation') continue;
    const tags = el.tags ?? {};
    const amenity = tags.amenity ?? (tags.leisure === 'park' ? 'park' : undefined);
    if (!amenity) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const name = tags.name?.trim();
    if (!name && amenity !== 'park') continue;
    pois.push({
      id: el.id,
      type: el.type,
      lat,
      lon,
      name: name ?? '(unnamed)',
      amenity,
      tags,
    });
  }
  return pois;
}

export function createOsmPoisIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestOsmPois(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      const config = city.dataSources.osmPois;
      if (!config) continue;
      try {
        await ingestCityOsmPois(city.id, city.name, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityOsmPois(
  cityId: string,
  areaName: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const query = buildOverpassQuery(areaName);
  const response = await log.fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'CityMonitor/1.0 (https://citymonitor.app)',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    log.warn(`${cityId}: Overpass API returned ${response.status}`);
    return;
  }
  const data = (await response.json()) as OverpassResponse;
  if (data.remark && /runtime error|timed out/i.test(data.remark)) {
    log.warn(`${cityId}: Overpass query error — ${data.remark}`);
    return;
  }
  const pois = parseOverpassResponse(data?.elements ?? []);
  const collection: OsmPoiCollection = {
    pois,
    fetchedAt: new Date().toISOString(),
    areaName,
  };
  cache.set(CK.osmPois(cityId), collection, POIS_TTL_SECONDS);
  if (db) {
    try {
      await saveOsmPois(db, cityId, collection);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }
  const counts = new Map<string, number>();
  for (const p of pois) counts.set(p.amenity, (counts.get(p.amenity) ?? 0) + 1);
  const breakdown = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
  log.info(`${cityId}: ${pois.length} OSM POIs (${breakdown})`);
}
