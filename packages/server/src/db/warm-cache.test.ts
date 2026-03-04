import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warmCache } from './warm-cache.js';
import { createCache } from '../lib/cache.js';
import type { Db } from './index.js';

vi.mock('./reads.js', () => ({
  loadWeather: vi.fn().mockResolvedValue({ current: { temp: 10 }, hourly: [], daily: [], alerts: [] }),
  loadTransitAlerts: vi.fn().mockResolvedValue([{ id: '1', line: 'U2', type: 'disruption', severity: 'high', message: 'Test', detail: 'Test detail', station: 'Alexanderplatz', location: { lat: 52.52, lon: 13.41 }, affectedStops: [] }]),
  loadEvents: vi.fn().mockResolvedValue([{ id: '1', title: 'Event', date: '2026-03-03', category: 'other', url: '' }]),
  loadSafetyReports: vi.fn().mockResolvedValue([{ id: '1', title: 'Report', description: '', publishedAt: '', url: '' }]),
  loadNewsItems: vi.fn().mockResolvedValue([{ id: 'n1', title: 'News', url: 'https://x.com', publishedAt: '2026-03-02', sourceName: 'Test', sourceUrl: 'https://x.com', category: 'politics', tier: 1, lang: 'de' }]),
  loadSummary: vi.fn().mockResolvedValue({ briefing: 'Test', generatedAt: '2026-03-02', headlineCount: 5, cached: true, headlineHash: 'abc' }),
  loadNinaWarnings: vi.fn().mockResolvedValue([]),
  loadAirQualityGrid: vi.fn().mockResolvedValue([{ lat: 52.52, lon: 13.41, europeanAqi: 42, station: 'Mitte' }]),
  loadAllGeocodeLookups: vi.fn().mockResolvedValue([]),
  loadPoliticalDistricts: vi.fn().mockResolvedValue(null),
}));

describe('warmCache', () => {
  let cache: ReturnType<typeof createCache>;

  beforeEach(() => {
    cache = createCache();
  });

  it('populates cache from DB for active cities', async () => {
    const db = {} as unknown as Db; // reads are mocked
    await warmCache(db, cache);

    expect(cache.get('berlin:weather')).not.toBeNull();
    expect(cache.get('berlin:transit:alerts')).not.toBeNull();
    expect(cache.get('berlin:events:upcoming')).not.toBeNull();
    expect(cache.get('berlin:safety:recent')).not.toBeNull();
    expect(cache.get('berlin:news:summary')).not.toBeNull();
    expect(cache.get('berlin:air-quality:grid')).not.toBeNull();
  });

  it('handles null returns from DB gracefully', async () => {
    const reads = await import('./reads.js');
    vi.mocked(reads.loadWeather).mockResolvedValueOnce(null);
    vi.mocked(reads.loadTransitAlerts).mockResolvedValueOnce(null);
    vi.mocked(reads.loadEvents).mockResolvedValueOnce(null);
    vi.mocked(reads.loadSafetyReports).mockResolvedValueOnce(null);
    vi.mocked(reads.loadNewsItems).mockResolvedValueOnce(null);
    vi.mocked(reads.loadSummary).mockResolvedValueOnce(null);
    vi.mocked(reads.loadNinaWarnings).mockResolvedValueOnce(null);
    vi.mocked(reads.loadAirQualityGrid).mockResolvedValueOnce(null);

    const db = {} as unknown as Db;
    await warmCache(db, cache);

    expect(cache.get('berlin:weather')).toBeNull();
    expect(cache.get('berlin:transit:alerts')).toBeNull();
    expect(cache.get('berlin:air-quality:grid')).toBeNull();
  });

  it('continues warming other domains if one fails', async () => {
    const reads = await import('./reads.js');
    vi.mocked(reads.loadWeather).mockRejectedValueOnce(new Error('DB error'));

    const db = {} as unknown as Db;
    await warmCache(db, cache);

    // Weather should be null (failed), but others should be populated
    expect(cache.get('berlin:weather')).toBeNull();
    expect(cache.get('berlin:transit:alerts')).not.toBeNull();
  });

  it('runs per-city reads in parallel, not sequentially', async () => {
    const reads = await import('./reads.js');
    const callOrder: string[] = [];

    // Track the order calls start (not finish)
    vi.mocked(reads.loadWeather).mockImplementation(async () => {
      callOrder.push('weather-start');
      await new Promise((r) => setTimeout(r, 5));
      callOrder.push('weather-end');
      return { current: { temp: 10 }, hourly: [], daily: [], alerts: [] } as never;
    });
    vi.mocked(reads.loadTransitAlerts).mockImplementation(async () => {
      callOrder.push('transit-start');
      await new Promise((r) => setTimeout(r, 5));
      callOrder.push('transit-end');
      return [] as never;
    });
    vi.mocked(reads.loadEvents).mockImplementation(async () => {
      callOrder.push('events-start');
      await new Promise((r) => setTimeout(r, 5));
      callOrder.push('events-end');
      return [] as never;
    });

    const db = {} as unknown as Db;
    await warmCache(db, cache);

    // If parallel: all starts happen before any ends
    const weatherStart = callOrder.indexOf('weather-start');
    const transitStart = callOrder.indexOf('transit-start');
    const eventsStart = callOrder.indexOf('events-start');
    const weatherEnd = callOrder.indexOf('weather-end');

    // All three should start before weather finishes
    expect(transitStart).toBeLessThan(weatherEnd);
    expect(eventsStart).toBeLessThan(weatherEnd);
    expect(weatherStart).toBeLessThan(weatherEnd);
  });
});
