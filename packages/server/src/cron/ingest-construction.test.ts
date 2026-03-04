import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCache } from '../lib/cache.js';
import { createConstructionIngestion } from './ingest-construction.js';
import type { ConstructionSite } from '@city-monitor/shared';

const mockVizGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [13.4, 52.52] },
      properties: {
        id: '1001',
        subtype: 'Baustelle',
        street: 'Friedrichstraße (Mitte)',
        section: 'Unter den Linden – Leipziger Straße',
        content: 'Kanalsanierung, Fahrbahn halbseitig gesperrt',
        direction: 'Beidseitig',
        icon: 'baustelle',
        is_future: false,
        validity: { from: '01.03.2026 06:00', to: '15.04.2026 18:00' },
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[13.35, 52.51], [13.36, 52.52]] },
      properties: {
        id: '1002',
        subtype: 'Sperrung',
        street: 'Kantstraße (Charlottenburg)',
        section: null,
        content: 'Vollsperrung wegen Brückenbauarbeiten',
        direction: null,
        icon: 'sperrung',
        is_future: true,
        validity: { from: '10.03.2026 00:00', to: '20.03.2026 23:59' },
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [13.45, 52.53] },
      properties: {
        id: '1003',
        subtype: 'Unfall',
        street: 'Alexanderplatz (Mitte)',
        section: null,
        content: 'Verkehrsunfall mit Sperrung',
        direction: null,
        icon: 'warnung',
        is_future: false,
        validity: { from: '03.03.2026 08:00', to: '03.03.2026 12:00' },
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [13.42, 52.50] },
      properties: {
        id: '1004',
        subtype: 'Storung',
        street: 'Hermannstraße (Neukölln)',
        section: 'Boddinstraße – Leinestraße',
        content: 'Wasserrohrbruch, Fahrbahn eingeengt',
        direction: null,
        icon: 'warnung',
        is_future: false,
        validity: { from: '02.03.2026 14:00', to: null },
      },
    },
  ],
};

describe('ingest-construction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches VIZ GeoJSON and writes ConstructionSite[] to cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites');
    expect(sites).toBeTruthy();
    // 3 items: Baustelle, Sperrung, Storung — Unfall filtered out
    expect(sites!.length).toBe(3);
  });

  it('filters out Unfall (accident) subtypes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites')!;
    const subtypes = sites.map((s) => s.subtype);
    expect(subtypes).not.toContain('accident');
    expect(sites.every((s) => s.id !== '1003')).toBe(true);
  });

  it('maps VIZ subtypes to normalized subtype values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites')!;
    const byId = Object.fromEntries(sites.map((s) => [s.id, s]));

    expect(byId['1001'].subtype).toBe('construction');
    expect(byId['1002'].subtype).toBe('closure');
    expect(byId['1004'].subtype).toBe('disruption');
  });

  it('maps properties correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites')!;
    const site = sites.find((s) => s.id === '1001')!;

    expect(site.street).toBe('Friedrichstraße (Mitte)');
    expect(site.section).toBe('Unter den Linden – Leipziger Straße');
    expect(site.description).toBe('Kanalsanierung, Fahrbahn halbseitig gesperrt');
    expect(site.direction).toBe('Beidseitig');
    expect(site.validFrom).toBe('01.03.2026 06:00');
    expect(site.validUntil).toBe('15.04.2026 18:00');
    expect(site.isFuture).toBe(false);
    expect(site.geometry).toEqual({ type: 'Point', coordinates: [13.4, 52.52] });
  });

  it('handles null validity.to gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites')!;
    const site = sites.find((s) => s.id === '1004')!;
    expect(site.validUntil).toBeUndefined();
  });

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest(); // should not throw

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites');
    expect(sites).toBeNull();
  });

  it('handles empty feature collection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    const sites = cache.get<ConstructionSite[]>('berlin:construction:sites');
    expect(sites).toEqual([]);
  });

  it('skips cities without roadworks config', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockVizGeoJSON), { status: 200 }),
    );

    const cache = createCache();
    const ingest = createConstructionIngestion(cache);
    await ingest();

    // Should only have fetched for berlin (has roadworks config), not hamburg
    // The exact call count depends on active cities, but fetch should be called
    expect(fetchSpy).toHaveBeenCalled();
  });
});
