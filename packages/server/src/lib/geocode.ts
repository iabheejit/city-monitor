/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { createLogger } from './logger.js';

const log = createLogger('geocode');

const TIMEOUT_MS = 5_000;
const USER_AGENT = 'CityMonitor/1.0 (https://github.com/OdinMB/city-monitor)';

// ---------------------------------------------------------------------------
// Provider: Nominatim (primary) — free, 1 req/s
// ---------------------------------------------------------------------------
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_GAP_MS = 1100; // slightly over 1s to stay safe
let nominatimLastRequest = 0;

function nominatimAvailable(): boolean {
  return Date.now() - nominatimLastRequest >= NOMINATIM_GAP_MS;
}

async function waitForNominatim(): Promise<void> {
  const elapsed = Date.now() - nominatimLastRequest;
  if (elapsed < NOMINATIM_GAP_MS) {
    await new Promise<void>((r) => setTimeout(r, NOMINATIM_GAP_MS - elapsed));
  }
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  nominatimLastRequest = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'de',
  });

  const response = await log.fetch(`${NOMINATIM_BASE}?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    log.warn(`Nominatim returned ${response.status} for "${query}"`);
    return null;
  }

  return parseResponse(await response.json());
}

// ---------------------------------------------------------------------------
// Provider: LocationIQ (fallback) — requires LOCATIONIQ_TOKEN
// ---------------------------------------------------------------------------
const LOCATIONIQ_TOKEN = process.env.LOCATIONIQ_TOKEN;
const LOCATIONIQ_BASE = 'https://us1.locationiq.com/v1/search';
const LOCATIONIQ_GAP_MS = 500; // free tier: 2 QPS
let locationiqLastRequest = 0;

async function waitForLocationIQ(): Promise<void> {
  const elapsed = Date.now() - locationiqLastRequest;
  if (elapsed < LOCATIONIQ_GAP_MS) {
    await new Promise<void>((r) => setTimeout(r, LOCATIONIQ_GAP_MS - elapsed));
  }
}

async function geocodeLocationIQ(query: string): Promise<GeocodeResult | null> {
  if (!LOCATIONIQ_TOKEN) return null;

  await waitForLocationIQ();
  locationiqLastRequest = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'de',
    key: LOCATIONIQ_TOKEN,
  });

  const response = await log.fetch(`${LOCATIONIQ_BASE}?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    log.warn(`LocationIQ returned ${response.status} for "${query}"`);
    return null;
  }

  return parseResponse(await response.json());
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

function parseResponse(
  results: Array<{ lat: string; lon: string; display_name: string }>,
): GeocodeResult | null {
  if (!results || results.length === 0) return null;
  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

/**
 * Geocode a location string.
 *
 * Strategy:
 * 1. If Nominatim rate limit is available, use Nominatim (free, 1 req/s).
 * 2. If Nominatim is rate-limited and LOCATIONIQ_TOKEN is set, use LocationIQ.
 * 3. If no LocationIQ token, wait for Nominatim.
 */
export async function geocode(
  location: string,
  cityName: string,
): Promise<GeocodeResult | null> {
  const query = `${location}, ${cityName}`;

  try {
    // Nominatim slot available — use it
    if (nominatimAvailable()) {
      return await geocodeNominatim(query);
    }

    // Nominatim busy — try LocationIQ if available
    if (LOCATIONIQ_TOKEN) {
      const result = await geocodeLocationIQ(query);
      if (result) return result;
      // LocationIQ failed — fall through to wait for Nominatim
    }

    // Wait for Nominatim
    await waitForNominatim();
    return await geocodeNominatim(query);
  } catch (err) {
    log.warn(`geocode failed for "${query}"`);
    return null;
  }
}
