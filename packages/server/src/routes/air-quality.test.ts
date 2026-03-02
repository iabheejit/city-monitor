/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';

describe('Air Quality API', () => {
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

  it('GET /api/berlin/air-quality returns null when no data', async () => {
    const res = await fetch(`${baseUrl}/api/berlin/air-quality`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });

  it('GET /api/berlin/air-quality returns cached data', async () => {
    const mockData = {
      current: {
        europeanAqi: 35,
        pm25: 12.5,
        pm10: 22.0,
        no2: 18.3,
        o3: 45.0,
        updatedAt: '2026-03-02T10:00:00Z',
      },
      hourly: [
        { time: '2026-03-02T10:00', europeanAqi: 35, pm25: 12.5, pm10: 22.0 },
        { time: '2026-03-02T11:00', europeanAqi: 38, pm25: 13.0, pm10: 23.0 },
      ],
    };
    appContext.cache.set('berlin:air-quality', mockData, 60);

    const res = await fetch(`${baseUrl}/api/berlin/air-quality`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.current.europeanAqi).toBe(35);
    expect(body.hourly).toHaveLength(2);
  });

  it('GET /api/unknown/air-quality returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/air-quality`);
    expect(res.status).toBe(404);
  });
});
