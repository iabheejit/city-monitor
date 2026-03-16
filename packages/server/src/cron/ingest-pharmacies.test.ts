import { describe, it, expect } from 'vitest';
import { parseDateTimeDE, formatDateDE } from './ingest-pharmacies.js';

describe('parseDateTimeDE', () => {
  it('parses date and time into ISO string', () => {
    expect(parseDateTimeDE('01.03.2026', '18:00')).toBe('2026-03-01T18:00:00');
  });

  it('defaults to 00:00 when time is empty', () => {
    expect(parseDateTimeDE('25.12.2026', '')).toBe('2026-12-25T00:00:00');
  });
});

describe('formatDateDE', () => {
  it('formats a Date into DD.MM.YYYY string', () => {
    const date = new Date(2026, 2, 1); // March 1, 2026
    expect(formatDateDE(date)).toBe('01.03.2026');
  });

  it('pads single-digit days and months with leading zero', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(formatDateDE(date)).toBe('05.01.2026');
  });
});
