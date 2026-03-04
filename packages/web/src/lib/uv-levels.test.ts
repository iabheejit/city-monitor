import { describe, it, expect } from 'vitest';
import { getUvLevel } from './uv-levels.js';

describe('getUvLevel', () => {
  it('returns low for UV index 0-2', () => {
    expect(getUvLevel(0)).toEqual({ level: 'low', color: '#4ade80' });
    expect(getUvLevel(1)).toEqual({ level: 'low', color: '#4ade80' });
    expect(getUvLevel(2)).toEqual({ level: 'low', color: '#4ade80' });
  });

  it('returns moderate for UV index 3-5', () => {
    expect(getUvLevel(3)).toEqual({ level: 'moderate', color: '#facc15' });
    expect(getUvLevel(4)).toEqual({ level: 'moderate', color: '#facc15' });
    expect(getUvLevel(5)).toEqual({ level: 'moderate', color: '#facc15' });
  });

  it('returns high for UV index 6-7', () => {
    expect(getUvLevel(6)).toEqual({ level: 'high', color: '#fb923c' });
    expect(getUvLevel(7)).toEqual({ level: 'high', color: '#fb923c' });
  });

  it('returns veryHigh for UV index 8-10', () => {
    expect(getUvLevel(8)).toEqual({ level: 'veryHigh', color: '#ef4444' });
    expect(getUvLevel(10)).toEqual({ level: 'veryHigh', color: '#ef4444' });
  });

  it('returns extreme for UV index 11+', () => {
    expect(getUvLevel(11)).toEqual({ level: 'extreme', color: '#a855f7' });
    expect(getUvLevel(15)).toEqual({ level: 'extreme', color: '#a855f7' });
  });

  it('handles fractional values by flooring', () => {
    expect(getUvLevel(2.9)).toEqual({ level: 'low', color: '#4ade80' });
    expect(getUvLevel(5.5)).toEqual({ level: 'moderate', color: '#facc15' });
  });
});
