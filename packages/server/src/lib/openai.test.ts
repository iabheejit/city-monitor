import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeHeadlines, getUsageStats, isConfigured, stripBareCityLabel } from './openai.js';

describe('openai', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isConfigured returns false when OPENAI_API_KEY is not set', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(isConfigured()).toBe(false);
  });

  it('summarizeHeadlines returns null when not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await summarizeHeadlines('Berlin', [{ title: 'Headline 1' }, { title: 'Headline 2' }], ['de']);
    expect(result).toBeNull();
  });

  it('getUsageStats returns empty object initially', () => {
    const stats = getUsageStats();
    expect(stats).toEqual({});
  });

  it('filterAndGeolocateNews returns null when not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { filterAndGeolocateNews } = await import('./openai.js');
    const result = await filterAndGeolocateNews('berlin', 'Berlin', []);
    expect(result).toBeNull();
  });

  it('geolocateReports returns null when not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { geolocateReports } = await import('./openai.js');
    const result = await geolocateReports('berlin', 'Berlin', []);
    expect(result).toBeNull();
  });
});

describe('stripBareCityLabel', () => {
  it('returns undefined for null input', () => {
    expect(stripBareCityLabel(null, 'berlin')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(stripBareCityLabel(undefined, 'berlin')).toBeUndefined();
  });

  it('strips exact city name', () => {
    expect(stripBareCityLabel('Berlin', 'berlin')).toBeUndefined();
  });

  it('strips city name with comma prefix', () => {
    expect(stripBareCityLabel('Berlin, Mitte', 'berlin')).toBeUndefined();
  });

  it('strips city name with paren prefix', () => {
    expect(stripBareCityLabel('Berlin (Mitte)', 'berlin')).toBeUndefined();
  });

  it('keeps legitimate sub-district label', () => {
    expect(stripBareCityLabel('Kreuzberg', 'berlin')).toBe('Kreuzberg');
  });

  it('keeps city name as substring (not prefix)', () => {
    expect(stripBareCityLabel('Ost-Berlin Museum', 'berlin')).toBe('Ost-Berlin Museum');
  });

  it('returns undefined for empty string', () => {
    expect(stripBareCityLabel('', 'berlin')).toBeUndefined();
  });
});
