/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { safeDateParse } from './safe-date-parse.js';

describe('safeDateParse', () => {
  it('parses a valid ISO string', () => {
    const d = safeDateParse('2026-03-02T12:00:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-03-02T12:00:00.000Z');
  });

  it('parses a date-only string', () => {
    const d = safeDateParse('2026-03-02');
    expect(d).toBeInstanceOf(Date);
  });

  it('returns null for empty string', () => {
    expect(safeDateParse('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(safeDateParse('not-a-date')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeDateParse(undefined as unknown as string)).toBeNull();
  });

  it('returns null for null', () => {
    expect(safeDateParse(null as unknown as string)).toBeNull();
  });
});
