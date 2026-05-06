/**
 * SF Transit Alerts ingestor — 511 SF Bay API.
 * Fetches GTFS-Realtime service alerts as JSON for Muni (SF) and BART (BA).
 * Requires SF_511_API_KEY env var.
 * Schedule: every 15 minutes.
 */
import type { SfTransitAlertsData, SfTransitAlert } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import type { Db } from '../db/index.js';
import { saveSfTransitAlerts } from '../db/writes.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { CK } from '../lib/cache-keys.js';

const log = createLogger('ingest-sf-transit');

const TTL_SECONDS = 900; // 15 min
const FETCH_TIMEOUT_MS = 20_000;
const BASE_URL = 'https://api.511.org/transit/servicealerts';

// 511 returns GTFS-RT JSON in a Google-style nested structure
interface Gtfs511Response {
  Entities?: Array<{
    Id?: string;
    IsDeleted?: boolean;
    Alert?: {
      HeaderText?: { Translation?: Array<{ Text?: string; Language?: string }> };
      DescriptionText?: { Translation?: Array<{ Text?: string; Language?: string }> };
      Effect?: string;
      InformedEntity?: Array<{
        AgencyId?: string;
        RouteId?: string;
      }>;
      ActivePeriod?: Array<{
        Start?: number;
        End?: number;
      }>;
    };
  }>;
}

function extractText(
  translations: Array<{ Text?: string; Language?: string }> | undefined,
): string {
  if (!translations || translations.length === 0) return '';
  const en = translations.find((t) => t.Language === 'en') ?? translations[0];
  return en.Text ?? '';
}

async function fetch511Alerts(
  agency: string,
  apiKey: string,
): Promise<Gtfs511Response> {
  const params = new URLSearchParams({
    api_key: apiKey,
    agency,
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
    // 511 API sometimes returns JSON with a BOM; strip it
    const text = await resp.text();
    const clean = text.replace(/^\uFEFF/, '');
    return JSON.parse(clean) as Gtfs511Response;
  } finally {
    clearTimeout(timer);
  }
}

function parseAlerts(data: Gtfs511Response, agencyLabel: string): SfTransitAlert[] {
  const entities = data.Entities ?? [];
  const alerts: SfTransitAlert[] = [];

  for (const entity of entities) {
    if (entity.IsDeleted) continue;
    const alert = entity.Alert;
    if (!alert) continue;

    const routeIds = (alert.InformedEntity ?? [])
      .map((e) => e.RouteId)
      .filter((id): id is string => Boolean(id));

    const activePeriods = alert.ActivePeriod ?? [];
    const first = activePeriods[0];

    alerts.push({
      id: entity.Id ?? String(Math.random()),
      agency: agencyLabel,
      routeIds,
      headerText: extractText(alert.HeaderText?.Translation),
      descriptionText: extractText(alert.DescriptionText?.Translation),
      effect: alert.Effect ?? 'UNKNOWN_EFFECT',
      start: first?.Start ? new Date(first.Start * 1000).toISOString() : null,
      end: first?.End ? new Date(first.End * 1000).toISOString() : null,
    });
  }

  return alerts;
}

async function ingestCitySfTransit(
  cityId: string,
  apiKey: string,
  cache: Cache,
  db: Db | null,
): Promise<void> {
  const [muniData, bartData] = await Promise.allSettled([
    fetch511Alerts('SF', apiKey),
    fetch511Alerts('BA', apiKey),
  ]);

  const alerts: SfTransitAlert[] = [];

  if (muniData.status === 'fulfilled') {
    alerts.push(...parseAlerts(muniData.value, 'Muni'));
  } else {
    log.warn(`${cityId}: Muni alerts fetch failed — ${muniData.reason}`);
  }

  if (bartData.status === 'fulfilled') {
    alerts.push(...parseAlerts(bartData.value, 'BART'));
  } else {
    log.warn(`${cityId}: BART alerts fetch failed — ${bartData.reason}`);
  }

  const data: SfTransitAlertsData = {
    alerts,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(CK.sfTransitAlerts(cityId), data, TTL_SECONDS);
  if (db) await saveSfTransitAlerts(db, cityId, data);
  log.info(`${cityId}: ${alerts.length} transit alerts (Muni + BART)`);
}

export function createSfTransitIngestion(cache: Cache, db: Db | null = null) {
  return async function ingestSfTransit(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (city.country !== 'US') continue;

      const apiKey = city.dataSources.sf511?.apiKey;
      if (!apiKey) {
        log.warn(`${city.id}: SF_511_API_KEY not set — skipping transit alerts`);
        continue;
      }

      try {
        await ingestCitySfTransit(city.id, apiKey, cache, db);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}
