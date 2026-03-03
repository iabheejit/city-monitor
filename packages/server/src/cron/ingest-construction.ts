/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ConstructionSite } from '@city-monitor/shared';
import type { Cache } from '../lib/cache.js';
import { getActiveCities } from '../config/index.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('ingest-construction');

export type { ConstructionSite };

const FETCH_TIMEOUT_MS = 15_000;

/** Map VIZ German subtype strings to normalized values */
const SUBTYPE_MAP: Record<string, ConstructionSite['subtype'] | null> = {
  Baustelle: 'construction',
  Sperrung: 'closure',
  Storung: 'disruption',
  Störung: 'disruption',
  Unfall: null, // filtered out
};

interface VizFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: {
    id: string;
    subtype: string;
    street: string;
    section?: string | null;
    content: string;
    direction?: string | null;
    icon: string;
    is_future: boolean;
    validity?: { from?: string | null; to?: string | null };
  };
}

interface VizGeoJSON {
  type: string;
  features?: VizFeature[];
}

export function createConstructionIngestion(cache: Cache) {
  return async function ingestConstruction(): Promise<void> {
    const cities = getActiveCities();
    for (const city of cities) {
      if (!city.dataSources.roadworks) continue;
      try {
        await ingestCityConstruction(city.id, city.dataSources.roadworks.url, cache);
      } catch (err) {
        log.error(`${city.id} failed`, err);
      }
    }
  };
}

async function ingestCityConstruction(cityId: string, url: string, cache: Cache): Promise<void> {
  const response = await log.fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'CityMonitor/1.0' },
  });

  if (!response.ok) {
    log.warn(`${cityId}: VIZ returned ${response.status}`);
    return;
  }

  const data = await response.json() as VizGeoJSON;
  const raw = data?.features ?? [];

  const sites: ConstructionSite[] = [];
  for (const feature of raw) {
    const props = feature.properties;
    const mapped = SUBTYPE_MAP[props.subtype];
    if (mapped === undefined) {
      log.warn(`${cityId}: unknown VIZ subtype "${props.subtype}"`);
      continue;
    }
    if (!mapped) continue; // filter out accidents (Unfall)

    sites.push({
      id: String(props.id),
      subtype: mapped,
      street: props.street,
      section: props.section ?? undefined,
      description: props.content,
      direction: props.direction ?? undefined,
      validFrom: props.validity?.from ?? undefined,
      validUntil: props.validity?.to ?? undefined,
      isFuture: props.is_future,
      geometry: feature.geometry as ConstructionSite['geometry'],
    });
  }

  cache.set(`${cityId}:construction:sites`, sites, 1800);
  log.info(`${cityId}: ${sites.length} construction sites updated`);
}
