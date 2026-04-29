import { useContext } from 'react';
import type { CityConfig } from '@city-monitor/shared';
import { CityContext } from './CityContext.js';

export function useCityConfig(): CityConfig {
  const config = useContext(CityContext);
  if (!config) {
    throw new Error('useCityConfig must be used within a CityProvider');
  }
  return config;
}

/** Returns the city config or null when rendered outside a CityProvider. */
export function useOptionalCityConfig(): CityConfig | null {
  return useContext(CityContext);
}
