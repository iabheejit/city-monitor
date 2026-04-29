import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { ConstructionSite } from '@city-monitor/shared';

describe('Construction API', () => {
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

  it('GET /api/berlin/construction returns empty data when no cache', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/construction`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/construction returns cached construction data', async () => {
    const mockData: ConstructionSite[] = [{
      id: 'construction-001',
      subtype: 'construction',
      street: 'Friedrichstrasse',
      description: 'Road resurfacing work',
      isFuture: false,
      geometry: { type: 'Point', coordinates: [13.3888, 52.5170] },
    }];
    appContext.cache.set('berlin:construction:sites', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/construction`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].street).toBe('Friedrichstrasse');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/construction returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/construction`);
    expect(res.status).toBe(404);
  });
});
