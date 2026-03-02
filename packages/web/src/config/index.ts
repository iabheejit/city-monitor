/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CityConfig } from '@city-monitor/shared';
import { berlin } from './cities/berlin.js';
import { hamburg } from './cities/hamburg.js';

const ALL_CITIES: Record<string, CityConfig> = {
  berlin,
  hamburg,
};

export function getCityConfig(cityId: string): CityConfig | undefined {
  return ALL_CITIES[cityId];
}

export function getAllCities(): CityConfig[] {
  return Object.values(ALL_CITIES);
}

export function getDefaultCityId(): string {
  return 'berlin';
}
