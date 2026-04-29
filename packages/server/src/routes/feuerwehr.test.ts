import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import type { FeuerwehrSummary } from '@city-monitor/shared';

describe('Feuerwehr API', () => {
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

  it('GET /api/berlin/feuerwehr returns empty data when no cache', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/feuerwehr`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('GET /api/berlin/feuerwehr returns cached feuerwehr data', async () => {
    const mockData: FeuerwehrSummary = {
      current: {
        reportMonth: '2026-02',
        missionCountAll: 28000,
        missionCountEms: 20000,
        missionCountFire: 3000,
        missionCountTechnicalRescue: 5000,
        responseTimeEmsCriticalMedian: 480,
        responseTimeFirePumpMedian: 360,
      },
      partial: null,
      previous: null,
    };
    appContext.cache.set('berlin:feuerwehr', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/feuerwehr`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.current.reportMonth).toBe('2026-02');
    expect(body.data.current.missionCountAll).toBe(28000);
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('GET /api/unknown/feuerwehr returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/feuerwehr`);
    expect(res.status).toBe(404);
  });
});
