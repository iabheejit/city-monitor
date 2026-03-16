import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { CouncilMeeting } from '@city-monitor/shared';

describe('Council Meetings API', () => {
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

  it('GET /api/berlin/council-meetings returns empty data when no cache', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/council-meetings`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/council-meetings returns cached meeting data', async () => {
    const mockData: CouncilMeeting[] = [{
      id: 'bvv-mitte-123',
      source: 'bvv',
      district: 'Mitte',
      committee: 'Ausschuss fur Stadtentwicklung',
      start: '2026-03-20T17:00:00+01:00',
      location: 'Rathaus Mitte',
    }];
    appContext.cache.set('berlin:council-meetings', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/council-meetings`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('bvv-mitte-123');
    expect(body.data[0].committee).toBe('Ausschuss fur Stadtentwicklung');
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/council-meetings returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/council-meetings`);
    expect(res.status).toBe(404);
  });
});
