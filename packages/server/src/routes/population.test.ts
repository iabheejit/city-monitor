import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { PopulationSummary } from '@city-monitor/shared';

describe('Population API', () => {
  let server: Server;
  let baseUrl: string;
  let appContext: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    appContext = await createApp({ skipScheduler: true });
    await new Promise<void>((resolve) => {
      server = appContext.app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/berlin/population returns null when no data', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/population`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/population returns cached GeoJSON', async () => {
    const mockGeojson = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [13.4, 52.5] }, properties: { plrId: '01010101' } }],
    };
    appContext.cache.set('berlin:population:geojson', mockGeojson, 60);

    const res = await fetch(`${baseUrl}/api/berlin/population`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.type).toBe('FeatureCollection');
    expect(body.data.features).toHaveLength(1);
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/berlin/population/summary returns null when no data', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/population/summary`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/population/summary returns cached summary', async () => {
    const mockSummary: PopulationSummary = {
      total: 3913644,
      density: 4400,
      foreignTotal: 970000,
      foreignPct: 24.8,
      elderlyPct: 19.2,
      youthPct: 16.1,
      workingAgePct: 64.7,
      changeAbsolute: 16499,
      changePct: 0.42,
      snapshotDate: '2025-12-31',
    };
    appContext.cache.set('berlin:population:summary', mockSummary, 60);

    const res = await fetch(`${baseUrl}/api/berlin/population/summary`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.total).toBe(3913644);
    expect(body.data.snapshotDate).toBe('2025-12-31');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/population returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/population`);
    expect(res.status).toBe(404);
  });
});
