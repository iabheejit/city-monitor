import { describe, it, expect } from 'vitest';
import { formatDayName } from './format-day-name.js';

describe('formatDayName', () => {
  it('returns a short weekday name for a known date', () => {
    // 2024-01-01 is a Monday
    const result = formatDayName('2024-01-01', 'en-US');
    expect(result).toBe('Mon');
  });

  it('returns todayLabel when date is today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = formatDayName(today, 'en-US', 'Today', 'Tomorrow');
    expect(result).toBe('Today');
  });

  it('returns tomorrowLabel when date is tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86400_000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const result = formatDayName(tomorrowStr, 'en-US', 'Today', 'Tomorrow');
    expect(result).toBe('Tomorrow');
  });

  it('returns a string on invalid input (does not throw)', () => {
    const result = formatDayName('not-a-date', 'en-US');
    // Should return something without throwing — either the raw dateStr
    // or the locale-formatted "Invalid Date" string depending on the engine
    expect(typeof result).toBe('string');
  });

  it('returns weekday when no labels are provided', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = formatDayName(today, 'en-US');
    // Should return a short weekday, not "Today"
    expect(result).not.toBe('Today');
    expect(result.length).toBeGreaterThan(0);
  });
});
