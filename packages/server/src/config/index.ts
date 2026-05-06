import type { CityConfig } from '@city-monitor/shared';
import { berlin } from './cities/berlin.js';
import { hamburg } from './cities/hamburg.js';
import { nagpur } from './cities/nagpur.js';
import { sanFrancisco } from './cities/san-francisco.js';

const ALL_CITIES: Record<string, CityConfig> = {
  berlin,
  hamburg,
  nagpur,
  'san-francisco': sanFrancisco,
};

function activeIds(): Set<string> {
  return new Set(
    (process.env.ACTIVE_CITIES || 'berlin,hamburg,nagpur,san-francisco')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getActiveCities(): CityConfig[] {
  const ids = activeIds();
  return [...ids]
    .map((id) => ALL_CITIES[id])
    .filter((c): c is CityConfig => c !== undefined);
}

/** Returns a city config only if the city is active. */
export function getCityConfig(cityId: string): CityConfig | undefined {
  return activeIds().has(cityId) ? ALL_CITIES[cityId] : undefined;
}
