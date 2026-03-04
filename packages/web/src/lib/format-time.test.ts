import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './format-time.js';

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30_000).toISOString())).toBe('just now');
  });

  it('returns minutes for timestamps less than 60 minutes ago', () => {
    const now = Date.now();
    const result = formatRelativeTime(new Date(now - 5 * 60_000).toISOString());
    expect(result).toMatch(/5\s*min/);
  });

  it('returns hours for timestamps less than 24 hours ago', () => {
    const now = Date.now();
    const result = formatRelativeTime(new Date(now - 3 * 3600_000).toISOString());
    expect(result).toMatch(/3\s*h/);
  });

  it('returns days for timestamps more than 24 hours ago', () => {
    const now = Date.now();
    const result = formatRelativeTime(new Date(now - 2 * 86400_000).toISOString());
    expect(result).toMatch(/2\s*d/);
  });

  it('handles invalid dates gracefully', () => {
    expect(formatRelativeTime('')).toBe('');
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
