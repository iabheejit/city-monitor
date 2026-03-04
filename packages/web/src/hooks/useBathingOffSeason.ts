import { useBathing } from './useBathing.js';

/** Returns true when any loaded bathing spot has inSeason === false. */
export function useBathingOffSeason(cityId: string): boolean {
  const { data } = useBathing(cityId);
  return data != null && data.length > 0 && !data[0].inSeason;
}
