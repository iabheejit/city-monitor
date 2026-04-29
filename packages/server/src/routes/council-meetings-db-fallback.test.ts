import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createCache } from '../lib/cache.js';
import { createCouncilMeetingsRouter } from './council-meetings.js';
import type { CouncilMeeting } from '@city-monitor/shared';

vi.mock('../db/reads.js', () => ({
  loadCouncilMeetings: vi.fn(),
}));

import { loadCouncilMeetings } from '../db/reads.js';

describe('Council Meetings API — DB fallback', () => {
  let server: Server;
  let baseUrl: string;
  let cache: ReturnType<typeof createCache>;
  const mockDb = {} as any;

  beforeAll(async () => {
    cache = createCache();
    const app = express();
    app.use('/api', createCouncilMeetingsRouter(cache, mockDb));

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
    vi.mocked(loadCouncilMeetings).mockReset();
  });

  it('returns DB data when cache is empty and DB has data', async () => {
    const mockData: CouncilMeeting[] = [{
      id: 'bvv-fk-456',
      source: 'bvv',
      district: 'Friedrichshain-Kreuzberg',
      committee: 'Bezirksverordnetenversammlung',
      start: '2026-03-20T18:00:00+01:00',
      location: 'Rathaus Kreuzberg',
    }];
    const fetchedAt = new Date('2026-03-17T08:00:00Z');
    vi.mocked(loadCouncilMeetings).mockResolvedValue({ data: mockData, fetchedAt });

    const res = await fetch(`${baseUrl}/api/berlin/council-meetings`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].district).toBe('Friedrichshain-Kreuzberg');
    expect(body.fetchedAt).toBe(fetchedAt.toISOString());
    expect(vi.mocked(loadCouncilMeetings)).toHaveBeenCalledWith(mockDb, 'berlin');
  });

  it('returns null default when DB throws error', async () => {
    vi.mocked(loadCouncilMeetings).mockRejectedValue(new Error('connection refused'));

    const res = await fetch(`${baseUrl}/api/berlin/council-meetings`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });

  it('returns null default when DB returns null', async () => {
    vi.mocked(loadCouncilMeetings).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/berlin/council-meetings`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.fetchedAt).toBeNull();
  });
});
