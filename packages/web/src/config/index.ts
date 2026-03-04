import type { CityConfig } from '@city-monitor/shared';
import { berlin } from './cities/berlin.js';
import { hamburg } from './cities/hamburg.js';

const ALL_CITIES: Record<string, CityConfig> = {
  berlin,
  hamburg,
};

/** Cities that are ready for users. Hamburg is kept in ALL_CITIES
 *  but excluded from active set until its data sources are complete. */
const ACTIVE_CITY_IDS = new Set(['berlin']);

export function getCityConfig(cityId: string): CityConfig | undefined {
  const config = ALL_CITIES[cityId];
  return config && ACTIVE_CITY_IDS.has(cityId) ? config : undefined;
}

export function getAllCities(): CityConfig[] {
  return Object.values(ALL_CITIES).filter((c) => ACTIVE_CITY_IDS.has(c.id));
}

export function getDefaultCityId(): string {
  return 'berlin';
}
