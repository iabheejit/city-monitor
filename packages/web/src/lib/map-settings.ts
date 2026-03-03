// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Odin Mühlenbein

/**
 * Map display settings — controls how many markers appear per layer.
 * Tune these to keep the map readable without overwhelming the user.
 */

export const MAP_NEWS = {
  /** Max news markers shown on the map total (before spatial bonus) */
  maxTotal: 25,
  /** Guaranteed slots per category (filled first, before importance ranking) */
  guaranteedPerCategory: 3,
  /** Max extra markers added to fill empty map areas */
  spatialBonusMax: 10,
  /** Grid cell size in degrees (~1 km at Berlin's latitude) */
  spatialGridSize: 0.01,
} as const;
