/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { classifyHeadline } from './classifier.js';

describe('classifyHeadline', () => {
  it('classifies transit headlines', () => {
    const result = classifyHeadline('S-Bahn Störung auf der Ringbahn', 'berlin');
    expect(result.category).toBe('transit');
  });

  it('classifies crime headlines', () => {
    const result = classifyHeadline('Polizei: Festnahme nach Überfall in Neukölln', 'berlin');
    expect(result.category).toBe('crime');
  });

  it('classifies politics headlines', () => {
    const result = classifyHeadline('Berliner Senat beschließt neues Klimagesetz', 'berlin');
    expect(result.category).toBe('politics');
  });

  it('classifies culture headlines', () => {
    const result = classifyHeadline('Berlinale 2026: Die besten Filme im Wettbewerb', 'berlin');
    expect(result.category).toBe('culture');
  });

  it('classifies weather headlines', () => {
    const result = classifyHeadline('Unwetterwarnung für Berlin und Brandenburg', 'berlin');
    expect(result.category).toBe('weather');
  });

  it('returns local as fallback category', () => {
    const result = classifyHeadline('Neuer Spielplatz in Friedrichshain eröffnet', 'berlin');
    expect(result.category).toBe('local');
  });

  it('returns confidence between 0 and 1', () => {
    const result = classifyHeadline('BVG Störung', 'berlin');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
