/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub env before importing geocode
vi.stubEnv('LOCATIONIQ_TOKEN', '');

const NOMINATIM_RESPONSE = [
  { lat: '52.5219184', lon: '13.4132147', display_name: 'Alexanderplatz, Mitte, Berlin' },
];

const EXPECTED_RESULT = {
  lat: 52.5219184,
  lon: 13.4132147,
  displayName: 'Alexanderplatz, Mitte, Berlin',
};

function mockOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('geocode (Nominatim only — no LOCATIONIQ_TOKEN)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns coordinates from Nominatim response', async () => {
    const { geocode } = await import('./geocode.js');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockOk(NOMINATIM_RESPONSE));

    const result = await geocode('Alexanderplatz', 'Berlin');
    expect(result).toEqual(EXPECTED_RESULT);

    const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(url).toContain('nominatim.openstreetmap.org');
  });

  it('returns null when no results found', async () => {
    const { geocode } = await import('./geocode.js');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockOk([]));

    const result = await geocode('Nonexistent Place XYZ', 'Berlin');
    expect(result).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const { geocode } = await import('./geocode.js');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 }),
    );

    const result = await geocode('Alexanderplatz', 'Berlin');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    const { geocode } = await import('./geocode.js');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await geocode('Alexanderplatz', 'Berlin');
    expect(result).toBeNull();
  });
});
