import { describe, it, expect } from 'vitest';
import { ICON_TO_TYPE, toSeverity } from './ingest-traffic.js';

describe('ICON_TO_TYPE', () => {
  it('maps iconCategory 1 to accident', () => {
    expect(ICON_TO_TYPE[1]).toBe('accident');
  });

  it('maps iconCategory 6 to jam', () => {
    expect(ICON_TO_TYPE[6]).toBe('jam');
  });

  it('maps iconCategory 7 to closure', () => {
    expect(ICON_TO_TYPE[7]).toBe('closure');
  });

  it('maps iconCategory 8 to closure', () => {
    expect(ICON_TO_TYPE[8]).toBe('closure');
  });

  it('maps iconCategory 9 to construction', () => {
    expect(ICON_TO_TYPE[9]).toBe('construction');
  });

  it('maps unknown categories to other', () => {
    for (const cat of [0, 2, 3, 4, 5, 10, 11, 12, 13, 14]) {
      expect(ICON_TO_TYPE[cat]).toBe('other');
    }
  });
});

describe('toSeverity', () => {
  it('returns critical for magnitude 4', () => {
    expect(toSeverity(4)).toBe('critical');
  });

  it('returns major for magnitude 3', () => {
    expect(toSeverity(3)).toBe('major');
  });

  it('returns moderate for magnitude 2', () => {
    expect(toSeverity(2)).toBe('moderate');
  });

  it('returns low for magnitude 1', () => {
    expect(toSeverity(1)).toBe('low');
  });

  it('returns low for magnitude 0', () => {
    expect(toSeverity(0)).toBe('low');
  });

  it('returns low for negative magnitude', () => {
    expect(toSeverity(-1)).toBe('low');
  });
});
