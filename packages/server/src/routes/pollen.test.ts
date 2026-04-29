import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { PollenForecast } from '@city-monitor/shared';

describe('Pollen API', () => {
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

  it('GET /api/berlin/pollen returns empty data when no cache', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/pollen`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/pollen returns cached pollen data', async () => {
    const mockData: PollenForecast = {
      region: 'Berlin',
      updatedAt: '2026-03-16',
      pollen: {
        Hasel: { today: '1', tomorrow: '1-2', dayAfterTomorrow: '2' },
        Erle: { today: '2', tomorrow: '2', dayAfterTomorrow: '2-3' },
        Esche: { today: '0', tomorrow: '0-1', dayAfterTomorrow: '1' },
        Birke: { today: '0', tomorrow: '0', dayAfterTomorrow: '0' },
        Graeser: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Roggen: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Beifuss: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Ambrosia: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
      },
    };
    appContext.cache.set('berlin:pollen', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/pollen`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.region).toBe('Berlin');
    expect(body.data.pollen.Hasel.today).toBe('1');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/pollen returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/pollen`);
    expect(res.status).toBe(404);
  });
});
