import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createCache } from '../lib/cache.js';
import { createPollenRouter } from './pollen.js';
import type { PollenForecast } from '@city-monitor/shared';

vi.mock('../db/reads.js', () => ({
  loadPollen: vi.fn(),
}));

import { loadPollen } from '../db/reads.js';

describe('Pollen API — DB fallback', () => {
  let server: Server;
  let baseUrl: string;
  let cache: ReturnType<typeof createCache>;
  const mockDb = {} as any;

  beforeAll(async () => {
    cache = createCache();
    const app = express();
    app.use('/api', createPollenRouter(cache, mockDb));

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
    vi.mocked(loadPollen).mockReset();
  });

  it('returns DB data when cache is empty and DB has data', async () => {
    const mockData: PollenForecast = {
      region: 'Berlin',
      updatedAt: '2026-03-17',
      pollen: {
        Hasel: { today: '2', tomorrow: '2-3', dayAfterTomorrow: '3' },
        Erle: { today: '1', tomorrow: '1-2', dayAfterTomorrow: '2' },
        Esche: { today: '0', tomorrow: '0', dayAfterTomorrow: '0-1' },
        Birke: { today: '0', tomorrow: '0', dayAfterTomorrow: '0' },
        Graeser: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Roggen: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Beifuss: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
        Ambrosia: { today: '-1', tomorrow: '-1', dayAfterTomorrow: '-1' },
      },
    };
    const fetchedAt = new Date('2026-03-17T06:00:00Z');
    vi.mocked(loadPollen).mockResolvedValue({ data: mockData, fetchedAt });

    const res = await fetch(`${baseUrl}/api/berlin/pollen`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.region).toBe('Berlin');
    expect(body.data.pollen.Hasel.today).toBe('2');
    expect(body.fetchedAt).toBe(fetchedAt.toISOString());
    expect(vi.mocked(loadPollen)).toHaveBeenCalledWith(mockDb, 'berlin');
  });

  it('returns null default when DB throws error', async () => {
    vi.mocked(loadPollen).mockRejectedValue(new Error('connection refused'));

    const res = await fetch(`${baseUrl}/api/berlin/pollen`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('returns null default when DB returns null', async () => {
    vi.mocked(loadPollen).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/berlin/pollen`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });
});
