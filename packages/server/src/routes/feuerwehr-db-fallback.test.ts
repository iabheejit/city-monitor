import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createCache } from '../lib/cache.js';
import { createFeuerwehrRouter } from './feuerwehr.js';
import type { FeuerwehrSummary } from '@city-monitor/shared';

vi.mock('../db/reads.js', () => ({
  loadFeuerwehr: vi.fn(),
}));

import { loadFeuerwehr } from '../db/reads.js';

describe('Feuerwehr API — DB fallback', () => {
  let server: Server;
  let baseUrl: string;
  let cache: ReturnType<typeof createCache>;
  const mockDb = {} as any;

  beforeAll(async () => {
    cache = createCache();
    const app = express();
    app.use('/api', createFeuerwehrRouter(cache, mockDb));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
  });

  beforeEach(() => {
    cache.clear();
    vi.mocked(loadFeuerwehr).mockReset();
  });

  it('returns DB data when cache is empty and DB has data', async () => {
    const mockData: FeuerwehrSummary = {
      current: {
        reportMonth: '2026-01',
        missionCountAll: 30000,
        missionCountEms: 21000,
        missionCountFire: 3500,
        missionCountTechnicalRescue: 5500,
        responseTimeEmsCriticalMedian: 470,
        responseTimeFirePumpMedian: 350,
      },
      partial: null,
      previous: null,
    };
    const fetchedAt = new Date('2026-03-17T09:00:00Z');
    vi.mocked(loadFeuerwehr).mockResolvedValue({ data: mockData, fetchedAt });

    const res = await fetch(`${baseUrl}/api/berlin/feuerwehr`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.current.reportMonth).toBe('2026-01');
    expect(body.data.current.missionCountAll).toBe(30000);
    expect(body.fetchedAt).toBe(fetchedAt.toISOString());
    expect(vi.mocked(loadFeuerwehr)).toHaveBeenCalledWith(mockDb, 'berlin');
  });

  it('returns null default when DB throws error', async () => {
    vi.mocked(loadFeuerwehr).mockRejectedValue(new Error('connection refused'));

    const res = await fetch(`${baseUrl}/api/berlin/feuerwehr`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('returns null default when DB returns null', async () => {
    vi.mocked(loadFeuerwehr).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/berlin/feuerwehr`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });
});
