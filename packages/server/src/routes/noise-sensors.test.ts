import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { NoiseSensor } from '@city-monitor/shared';

describe('Noise Sensors API', () => {
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

  it('GET /api/berlin/noise-sensors returns empty data when no cache', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/noise-sensors`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/noise-sensors returns cached sensor data', async () => {
    const mockData: NoiseSensor[] = [{
      id: 12345,
      lat: 52.52,
      lon: 13.405,
      laeq: 55.3,
      laMin: 42.1,
      laMax: 68.7,
    }];
    appContext.cache.set('berlin:noise-sensors', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/noise-sensors`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].laeq).toBe(55.3);
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/noise-sensors returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/noise-sensors`);
    expect(res.status).toBe(404);
  });
});
