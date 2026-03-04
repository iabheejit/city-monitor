import { describe, it, expect } from 'vitest';
import { hashString } from './hash.js';

describe('hashString', () => {
  it('produces consistent output for the same input', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });

  it('produces different output for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('handles empty string', () => {
    const result = hashString('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a 12-char hex string', () => {
    const result = hashString('test');
    expect(result).toMatch(/^[0-9a-f]{12}$/);
  });

  it('returns different hashes for similar inputs', () => {
    const a = hashString('https://example.com/article-1Title A');
    const b = hashString('https://example.com/article-1Title B');
    expect(a).not.toBe(b);
  });
});
