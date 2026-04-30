import type { CpcbAqiData, CpcbStation, CpcbPollutants } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveCpcbAqi } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-cpcb-aqi');

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';
const FETCH_TIMEOUT_MS = 20_000;
const TTL_SECONDS = 1800; // 30 min (data updates ~hourly)

interface CpcbRow {
  country?: string;
  state?: string;
  city?: string;
  station?: string;
  last_update?: string;
  latitude?: string;
  longitude?: string;
  pollutant_id?: string;
  min_value?: string;
  max_value?: string;
  avg_value?: string;
}

function parseNum(val: string | undefined): number | undefined {
  if (!val || val.trim() === 'NA' || val.trim() === '') return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function mapPollutantId(id: string): keyof CpcbPollutants | null {
  switch (id.trim().toUpperCase()) {
    case 'PM2.5': return 'pm25';
    case 'PM10': return 'pm10';
    case 'NO2': return 'no2';
    case 'OZONE': return 'o3';
    case 'SO2': return 'so2';
    case 'CO': return 'co';
    case 'NH3': return 'nh3';
    default: return null;
  }
}

export function parseCpcbRows(rows: CpcbRow[]): CpcbAqiData {
  // Group rows by station name
  const stationMap = new Map<string, { lat: number; lon: number; pollutants: CpcbPollutants; lastUpdate: string }>();

  for (const row of rows) {
    const stationName = (row.station ?? '').trim();
    if (!stationName) continue;

    const lat = parseNum(row.latitude) ?? 0;
    const lon = parseNum(row.longitude) ?? 0;
    const lastUpdate = (row.last_update ?? '').trim();
    const pollutantKey = mapPollutantId(row.pollutant_id ?? '');
    const avgValue = parseNum(row.avg_value);

    if (!stationMap.has(stationName)) {
      stationMap.set(stationName, { lat, lon, pollutants: {}, lastUpdate });
    }

    const entry = stationMap.get(stationName)!;
    if (pollutantKey !== null && avgValue !== undefined) {
      entry.pollutants[pollutantKey] = avgValue;
    }
    // Use the most recent last_update across rows for this station
    if (lastUpdate > entry.lastUpdate) {
      entry.lastUpdate = lastUpdate;
    }
  }

  const stations: CpcbStation[] = Array.from(stationMap.entries()).map(([station, data]) => ({
    station,
    lat: data.lat,
    lon: data.lon,
    pollutants: data.pollutants,
    lastUpdate: data.lastUpdate,
  }));

  return { stations, fetchedAt: new Date().toISOString() };
}

async function ingestCityCpcbAqi(cityId: string, cityName: string, cache: Cache, db: Db | null): Promise<void> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    log.warn(`${cityId} DATA_GOV_IN_API_KEY not set, skipping`);
    return;
  }

  const url = new URL(DATA_GOV_IN_BASE);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('filters[city]', cityName);
  url.searchParams.set('limit', '100');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let rows: CpcbRow[];
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      log.warn(`${cityId} HTTP ${res.status}`);
      return;
    }
    const json = await res.json() as { records?: CpcbRow[] };
    rows = json.records ?? [];
  } finally {
    clearTimeout(timeout);
  }

  if (rows.length === 0) {
    log.warn(`${cityId} no CPCB AQI records for city="${cityName}"`);
    return;
  }

  const data = parseCpcbRows(rows);

  cache.set(CK.cpcbAqi(cityId), data, TTL_SECONDS);

  if (db) {
    try {
      await saveCpcbAqi(db, cityId, data);
    } catch (err) {
      log.error(`${cityId} DB write failed`, err);
    }
  }

  log.info(`${cityId} saved ${data.stations.length} CPCB stations`);
}

export function createCpcbAqiIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestCpcbAqi(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.cpcbAqi) continue;
      try {
        await ingestCityCpcbAqi(city.id, city.dataSources.cpcbAqi.cityName, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
