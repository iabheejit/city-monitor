/**
 * Map display settings — controls how many markers appear per layer.
 * Tune these to keep the map readable without overwhelming the user.
 */

export const MAP_NEWS = {
  /** Max news markers shown on the map total (before spatial bonus) */
  maxTotal: 15,
  /** Guaranteed slots per category (filled first, before importance ranking) */
  guaranteedPerCategory: 2,
  /** Max extra markers added to fill empty map areas (farthest-first) */
  spatialBonusMax: 25,
  /** Minimum importance for spatial bonus items (Phase 3, filling empty areas) */
  minImportanceSpatial: 0.3,
  /**
   * Minimum squared-degree distance from the nearest existing marker for a
   * spatial bonus candidate to be accepted.  Candidates closer than this are
   * skipped — they would just pile onto an already crowded area.
   * ~0.005 ≈ roughly 500 m in Berlin latitude.
   */
  minSpatialGapSq: 0.0004,
} as const;

/** Dense point layers get a minimum zoom so they don't clutter the city view. */
export const MAP_DENSITY = {
  /** Min zoom for pharmacy markers */
  pharmacyMinZoom: 12,
  /** Min zoom for AED markers */
  aedMinZoom: 13,
} as const;
