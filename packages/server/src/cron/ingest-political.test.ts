import { describe, it, expect } from 'vitest';
import {
  normalizeParty,
  normalizeConstituencyName,
  mandateToRepresentative,
  filterBundestagForCity,
  deduplicateMandates,
  constituencyToBezirk,
} from './ingest-political.js';

describe('normalizeParty', () => {
  it('extracts SPD', () => expect(normalizeParty('Fraktion der SPD')).toBe('SPD'));
  it('extracts CDU (checked before CSU)', () => expect(normalizeParty('CDU/CSU - Fraktion')).toBe('CDU'));
  it('extracts Gruene (uppercase)', () => expect(normalizeParty('Fraktion BÜNDNIS 90/DIE GRÜNEN')).toBe('Grüne'));
  it('extracts BSW', () => expect(normalizeParty('Fraktion Bündnis Sahra Wagenknecht - BSW')).toBe('BSW'));
  it('extracts Die Linke', () => expect(normalizeParty('Die Linke')).toBe('Die Linke'));
  it('extracts Fraktionslos (case-insensitive)', () => expect(normalizeParty('fraktionslos')).toBe('Fraktionslos'));
  it('returns unknown party as-is', () => expect(normalizeParty('Piratenpartei')).toBe('Piratenpartei'));
  it('extracts AfD', () => expect(normalizeParty('AfD')).toBe('AfD'));
});

describe('normalizeConstituencyName', () => {
  it('strips number prefix and parenthetical', () => {
    expect(normalizeConstituencyName('78 - Berlin-Steglitz-Zehlendorf (Bundestag 2025 - 2029)'))
      .toBe('Berlin-Steglitz-Zehlendorf');
  });
  it('returns plain name unchanged', () => {
    expect(normalizeConstituencyName('Berlin-Mitte')).toBe('Berlin-Mitte');
  });
  it('strips number prefix and parenthetical, preserves trailing number', () => {
    expect(normalizeConstituencyName('3 - Charlottenburg-Wilmersdorf 1 (Abgeordnetenhaus 2023 - 2028)'))
      .toBe('Charlottenburg-Wilmersdorf 1');
  });
});

// Helper to build minimal AW_Mandate-compatible objects
function makeMandateObj(overrides: {
  id?: number;
  politicianId?: number;
  politicianLabel?: string;
  fractionLabel?: string;
  constituencyLabel?: string;
  listLabel?: string;
} = {}) {
  return {
    id: overrides.id ?? 1,
    label: 'mandate',
    politician: {
      id: overrides.politicianId ?? 1,
      label: overrides.politicianLabel ?? 'Max Mustermann',
      abgeordnetenwatch_url: 'https://example.com',
    },
    ...(overrides.fractionLabel !== undefined
      ? { fraction_membership: [{ fraction: { label: overrides.fractionLabel } }] }
      : {}),
    electoral_data: {
      ...(overrides.constituencyLabel !== undefined
        ? { constituency: { label: overrides.constituencyLabel } }
        : {}),
      ...(overrides.listLabel !== undefined
        ? { electoral_list: { label: overrides.listLabel } }
        : {}),
    },
  };
}

describe('mandateToRepresentative', () => {
  it('converts mandate with constituency to Representative', () => {
    const m = makeMandateObj({
      politicianLabel: 'Erika Muster',
      fractionLabel: 'Fraktion der SPD',
      constituencyLabel: '78 - Berlin-Steglitz-Zehlendorf (Bundestag 2025 - 2029)',
    });
    const rep = mandateToRepresentative(m as any, 'MdB');
    expect(rep).toMatchObject({
      name: 'Erika Muster',
      party: 'SPD',
      role: 'MdB',
      constituency: 'Berlin-Steglitz-Zehlendorf',
    });
  });

  it('defaults party to Parteilos when no fraction_membership', () => {
    const m = makeMandateObj({ politicianLabel: 'Hans Solo' });
    const rep = mandateToRepresentative(m as any, 'MdA');
    expect(rep.party).toBe('Parteilos');
  });

  it('constituency is undefined when no electoral_data.constituency', () => {
    const m = {
      id: 1,
      label: 'mandate',
      politician: { id: 1, label: 'Test', abgeordnetenwatch_url: 'https://example.com' },
      fraction_membership: [{ fraction: { label: 'SPD' } }],
      electoral_data: {},
    };
    const rep = mandateToRepresentative(m as any, 'MdB');
    expect(rep.constituency).toBeUndefined();
  });
});

describe('filterBundestagForCity', () => {
  it('keeps mandates with city name in constituency label', () => {
    const m = makeMandateObj({ constituencyLabel: 'Berlin-Mitte' });
    expect(filterBundestagForCity([m] as any[], 'Berlin')).toHaveLength(1);
  });

  it('keeps mandates with city name in electoral list label', () => {
    const m = makeMandateObj({ listLabel: 'Landesliste Berlin' });
    expect(filterBundestagForCity([m] as any[], 'Berlin')).toHaveLength(1);
  });

  it('drops mandates from other cities', () => {
    const m = makeMandateObj({ constituencyLabel: 'Hamburg-Mitte' });
    expect(filterBundestagForCity([m] as any[], 'Berlin')).toHaveLength(0);
  });

  it('drops mandates with no constituency or list data', () => {
    const m = { id: 1, label: 'x', politician: { id: 1, label: 'X', abgeordnetenwatch_url: '' } };
    expect(filterBundestagForCity([m] as any[], 'Berlin')).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const m = makeMandateObj({ constituencyLabel: 'berlin-mitte' });
    expect(filterBundestagForCity([m] as any[], 'Berlin')).toHaveLength(1);
  });
});

describe('deduplicateMandates', () => {
  it('keeps first mandate per politician ID', () => {
    const m1 = makeMandateObj({ politicianId: 1 });
    const m2 = makeMandateObj({ politicianId: 1 });
    expect(deduplicateMandates([m1, m2] as any[])).toHaveLength(1);
  });

  it('keeps all mandates with unique politician IDs', () => {
    const m1 = makeMandateObj({ politicianId: 1 });
    const m2 = makeMandateObj({ politicianId: 2 });
    const m3 = makeMandateObj({ politicianId: 3 });
    expect(deduplicateMandates([m1, m2, m3] as any[])).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateMandates([])).toEqual([]);
  });
});

describe('constituencyToBezirk', () => {
  const bezirke = [
    'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow',
    'Charlottenburg-Wilmersdorf', 'Spandau', 'Steglitz-Zehlendorf',
    'Tempelhof-Sch\u00f6neberg', 'Neuk\u00f6lln', 'Treptow-K\u00f6penick',
    'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf',
  ];

  it('maps numbered constituency to bezirk', () => {
    expect(constituencyToBezirk('Charlottenburg-Wilmersdorf 3', bezirke)).toBe('Charlottenburg-Wilmersdorf');
  });

  it('handles umlauts', () => {
    expect(constituencyToBezirk('Tempelhof-Sch\u00f6neberg 1', bezirke)).toBe('Tempelhof-Sch\u00f6neberg');
  });

  it('maps Mitte', () => {
    expect(constituencyToBezirk('Mitte 2', bezirke)).toBe('Mitte');
  });

  it('returns null for non-Berlin constituency', () => {
    expect(constituencyToBezirk('Brandenburg 5', bezirke)).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(constituencyToBezirk('mitte 1', bezirke)).toBe('Mitte');
  });
});
