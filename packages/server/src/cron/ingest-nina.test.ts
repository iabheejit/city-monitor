import { describe, it, expect } from 'vitest';
import { mapSeverity, detectSource, isDwdSource, parseDashboardWarning } from './ingest-nina.js';
import type { DashboardWarning } from './ingest-nina.js';

describe('mapSeverity', () => {
  it('maps "Extreme" to extreme (case-insensitive)', () => {
    expect(mapSeverity('Extreme')).toBe('extreme');
    expect(mapSeverity('EXTREME')).toBe('extreme');
  });

  it('maps "Severe" to severe', () => {
    expect(mapSeverity('Severe')).toBe('severe');
  });

  it('maps "Moderate" to moderate', () => {
    expect(mapSeverity('Moderate')).toBe('moderate');
  });

  it('maps "Minor" to minor', () => {
    expect(mapSeverity('Minor')).toBe('minor');
  });

  it('maps unknown strings to minor', () => {
    expect(mapSeverity('something-else')).toBe('minor');
  });

  it('maps undefined/null to minor', () => {
    expect(mapSeverity(undefined as unknown as string)).toBe('minor');
    expect(mapSeverity(null as unknown as string)).toBe('minor');
  });
});

describe('detectSource', () => {
  it('detects mowas', () => {
    expect(detectSource('mow.xxx')).toBe('mowas');
  });

  it('detects biwapp', () => {
    expect(detectSource('biwapp.xxx')).toBe('biwapp');
  });

  it('detects katwarn', () => {
    expect(detectSource('katwarn.xxx')).toBe('katwarn');
  });

  it('detects dwd', () => {
    expect(detectSource('dwd.xxx')).toBe('dwd');
  });

  it('detects lhp', () => {
    expect(detectSource('lhp.xxx')).toBe('lhp');
  });

  it('detects police', () => {
    expect(detectSource('police.xxx')).toBe('police');
  });

  it('defaults to mowas for unknown prefix', () => {
    expect(detectSource('unknown.xxx')).toBe('mowas');
  });
});

describe('isDwdSource', () => {
  it('returns true for id starting with "dwd."', () => {
    expect(isDwdSource({ id: 'dwd.123', version: 1, startDate: '', severity: '', type: '', i18nTitle: { de: '' } })).toBe(true);
  });

  it('returns true for type containing "dwd" (case-insensitive)', () => {
    expect(isDwdSource({ id: 'other.123', version: 1, startDate: '', severity: '', type: 'DWD-Alert', i18nTitle: { de: '' } })).toBe(true);
  });

  it('returns false for non-DWD warnings', () => {
    expect(isDwdSource({ id: 'mow.123', version: 1, startDate: '', severity: '', type: 'MOWAS', i18nTitle: { de: '' } })).toBe(false);
  });
});

describe('parseDashboardWarning', () => {
  const validWarning: DashboardWarning = {
    id: 'mow.DE-NW-BN-SE030-20210714-30-001',
    version: 2,
    startDate: '2026-01-01T00:00:00Z',
    expiresDate: '2026-01-02T00:00:00Z',
    severity: 'Severe',
    type: 'Alert',
    i18nTitle: { de: 'Warnung vor Hochwasser' },
  };

  it('parses a valid dashboard warning into NinaWarning', () => {
    const result = parseDashboardWarning(validWarning);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(validWarning.id);
    expect(result!.headline).toBe('Warnung vor Hochwasser');
    expect(result!.severity).toBe('severe');
    expect(result!.source).toBe('mowas');
    expect(result!.version).toBe(2);
    expect(result!.startDate).toBe('2026-01-01T00:00:00Z');
    expect(result!.expiresAt).toBe('2026-01-02T00:00:00Z');
  });

  it('returns null when headline (i18nTitle.de) is missing', () => {
    const noHeadline = { ...validWarning, i18nTitle: { de: '' } };
    const result = parseDashboardWarning(noHeadline);
    expect(result).toBeNull();
  });
});
