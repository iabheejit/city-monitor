import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'node:http';
import http from 'node:http';
import express from 'express';

/** Simple HTTP GET using node:http (avoids globalThis.fetch which we mock). */
function httpGet(url: string): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('Weather Tiles API — no radar path', () => {
  let server: Server;
  let baseUrl: string;
  let cleanup: () => void;

  beforeAll(async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', mockFetch);

    const { createWeatherTilesRouter } = await import('./weather-tiles.js');
    const app = express();
    app.use('/api', createWeatherTilesRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    cleanup = () => {
      vi.unstubAllGlobals();
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    cleanup();
  });

  it('returns fallback PNG when radar path is not available', async () => {
    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/4/4.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['x-weather-tile-fallback']).toBe('true');
  });
});

describe('Weather Tiles API — with radar path', () => {
  let server: Server;
  let baseUrl: string;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // Reset module registry so weather-tiles.ts re-executes with new fetch mock
    vi.resetModules();

    mockFetch = vi.fn();
    // First call: refreshRadarPath fetches RainViewer API
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ radar: { past: [{ path: '/v2/radar/12345' }] } })),
    );
    vi.stubGlobal('fetch', mockFetch);

    const { createWeatherTilesRouter } = await import('./weather-tiles.js');
    const app = express();
    app.use('/api', createWeatherTilesRouter());

    // Let the refreshRadarPath() promise settle
    await new Promise((r) => setTimeout(r, 50));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid tile coordinates (z > 7)', async () => {
    const res = await httpGet(`${baseUrl}/api/weather-tiles/8/0/0.png`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative coordinates', async () => {
    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/-1/0.png`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for x >= 2^z', async () => {
    // z=3 -> maxCoord=8, so x=8 is invalid
    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/8/0.png`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer coordinates', async () => {
    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/1.5/0.png`);
    expect(res.status).toBe(400);
  });

  it('proxies valid tile request successfully', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    mockFetch.mockResolvedValueOnce(
      new Response(pngBuffer, { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/4/4.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['cache-control']).toMatch(/max-age=300/);
  });

  it('returns fallback PNG when upstream tile fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const res = await httpGet(`${baseUrl}/api/weather-tiles/3/4/4.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['x-weather-tile-fallback']).toBe('true');
  });
});
