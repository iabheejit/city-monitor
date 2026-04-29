import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'node:http';
import express from 'express';
import { createCache } from '../lib/cache.js';
import { createWeatherRouter } from './weather.js';
import type { WeatherData } from '../cron/ingest-weather.js';

vi.mock('../db/reads.js', () => ({
  loadWeather: vi.fn(),
  loadWeatherHistory: vi.fn(),
}));

import { loadWeather, loadWeatherHistory } from '../db/reads.js';

describe('Weather API — DB fallback', () => {
  let server: Server;
  let baseUrl: string;
  let cache: ReturnType<typeof createCache>;
  const mockDb = {} as any;

  beforeAll(async () => {
    cache = createCache();
    const app = express();
    app.use('/api', createWeatherRouter(cache, mockDb));

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
    vi.mocked(loadWeather).mockReset();
    vi.mocked(loadWeatherHistory).mockReset();
  });

  it('returns DB data when cache is empty and DB has data', async () => {
    const mockWeather: WeatherData = {
      current: { temp: 8, feelsLike: 6, humidity: 80, precipitation: 1, weatherCode: 61, windSpeed: 10, windDirection: 180 },
      hourly: [{ time: '2026-03-17T12:00', temp: 9, precipProb: 60, weatherCode: 61 }],
      daily: [{ date: '2026-03-17', high: 11, low: 4, weatherCode: 61, precip: 2.5, sunrise: '06:10', sunset: '18:25' }],
      alerts: [],
    };
    const fetchedAt = new Date('2026-03-17T10:00:00Z');
    vi.mocked(loadWeather).mockResolvedValue({ data: mockWeather, fetchedAt });

    const res = await fetch(`${baseUrl}/api/berlin/weather`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.current.temp).toBe(8);
    expect(body.data.hourly).toHaveLength(1);
    expect(body.fetchedAt).toBe(fetchedAt.toISOString());
    expect(vi.mocked(loadWeather)).toHaveBeenCalledWith(mockDb, 'berlin');
  });

  it('returns empty default when DB throws error', async () => {
    vi.mocked(loadWeather).mockRejectedValue(new Error('connection refused'));

    const res = await fetch(`${baseUrl}/api/berlin/weather`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ current: null, hourly: [], daily: [], alerts: [] });
    expect(body.fetchedAt).toBeNull();
  });

  it('returns empty default when DB returns null', async () => {
    vi.mocked(loadWeather).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/berlin/weather`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ current: null, hourly: [], daily: [], alerts: [] });
    expect(body.fetchedAt).toBeNull();
  });
});
