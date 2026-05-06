/**
 * SF Traffic Events ingestor — 511 SF Bay API.
 * Fetches current traffic events and keeps San Francisco area items.
 * Requires SF_511_API_KEY env var.
 */
import type { SfTrafficEvent, SfTrafficEventsData } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSfTrafficEvents } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-sf-traffic-events');

const TTL_SECONDS = 900;
const FETCH_TIMEOUT_MS = 20_000;
const BASE_URL = 'https://api.511.org/traffic/events';

interface TrafficEventResponse {
  events?: Array<{
    id?: string;
    status?: string;
    headline?: string;
    event_type?: string;
    severity?: string;
    updated?: string;
    areas?: Array<{ name?: string }>;
    roads?: Array<{ name?: string; direction?: string; from?: string; to?: string }>;
    geography?: { coordinates?: [number, number] };
    schedule?: { intervals?: string[] };
  }>;
}

async function fetchTrafficEvents(apiKey: string): Promise<TrafficEventResponse> {
  const params = new URLSearchParams({
    api_key: apiKey,
    format: 'json',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${BASE_URL}?${params}`, {
      headers: { 'User-Agent': 'CityMonitor/1.0' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    return JSON.parse(text.replace(/^\uFEFF/, '')) as TrafficEventResponse;
  } finally {
    clearTimeout(timer);
  }
}

function parseInterval(interval: string | undefined): { startsAt: string | null; endsAt: string | null } {
  if (!interval || !interval.includes('/')) return { startsAt: null, endsAt: null };
  const [startsAt, endsAt] = interval.split('/');
  return { startsAt: startsAt || null, endsAt: endsAt || null };
}

function normalizeRoads(roads: Array<{ name?: string; direction?: string; from?: string; to?: string }> | undefined): string[] {
  if (!roads || roads.length === 0) return [];
  return roads
    .map((r) => [r.name, r.direction, r.from ? `from ${r.from}` : null, r.to ? `to ${r.to}` : null].filter(Boolean).join(' '))
    .filter((v): v is string => Boolean(v));
}

function isInSanFrancisco(areas: Array<{ name?: string }> | undefined): boolean {
  if (!areas || areas.length === 0) return false;
  return areas.some((a) => (a.name ?? '').toLowerCase().includes('san francisco'));
}

function parseEvents(raw: TrafficEventResponse): SfTrafficEvent[] {
  const events = raw.events ?? [];
  const parsed: SfTrafficEvent[] = [];

  for (const e of events) {
    if (!e.id || !e.headline) continue;
    if (!isInSanFrancisco(e.areas)) continue;

    const interval = parseInterval(e.schedule?.intervals?.[0]);
    const coordinates = e.geography?.coordinates;
    const location = Array.isArray(coordinates) && coordinates.length === 2
      ? { lon: coordinates[0], lat: coordinates[1] }
      : null;

    parsed.push({
      id: e.id,
      status: e.status ?? 'UNKNOWN',
      headline: e.headline,
      eventType: e.event_type ?? 'OTHER',
      severity: e.severity ?? 'Unknown',
      updatedAt: e.updated ?? new Date().toISOString(),
      startsAt: interval.startsAt,
      endsAt: interval.endsAt,
      areas: (e.areas ?? []).map((a) => a.name).filter((n): n is string => Boolean(n)),
      roads: normalizeRoads(e.roads),
      location,
    });
  }

  parsed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return parsed;
}

async function ingestCityTrafficEvents(
  cityId: string,
  apiKey: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const raw = await fetchTrafficEvents(apiKey);
  const events = parseEvents(raw);

  const data: SfTrafficEventsData = {
    events,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.sfTrafficEvents(cityId), data, TTL_SECONDS);
  if (db) await saveSfTrafficEvents(db, cityId, data);

  log.info(`${cityId}: ${events.length} SF traffic events`);
}

export function createSfTrafficEventsIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestSfTrafficEvents(): Promise<void> {
    const cities = getActiveCities();

    for (const city of cities) {
      if (city.country !== 'US') continue;

      const apiKey = city.dataSources.sf511?.apiKey;
      if (!apiKey) {
        log.warn(`${city.id}: SF_511_API_KEY not set — skipping traffic events`);
        continue;
      }

      try {
        await ingestCityTrafficEvents(city.id, apiKey, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
