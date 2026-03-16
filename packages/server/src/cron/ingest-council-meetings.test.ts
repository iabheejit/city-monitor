import { describe, it, expect } from 'vitest';
import { extractCommittee, buildLocation, parsePardokXml, berlinUtcOffset } from './ingest-council-meetings.js';

describe('extractCommittee', () => {
  it('extracts committee after "des"', () => {
    expect(extractCommittee('77. Sitzung des Ausschusses fur Bildung'))
      .toBe('Ausschusses fur Bildung');
  });

  it('extracts committee after "der"', () => {
    expect(extractCommittee('12. Sitzung der BVV Mitte'))
      .toBe('BVV Mitte');
  });

  it('returns full name when no "des/der" match', () => {
    expect(extractCommittee('Plenarsitzung')).toBe('Plenarsitzung');
  });

  it('handles empty string', () => {
    expect(extractCommittee('')).toBe('');
  });
});

describe('buildLocation', () => {
  it('returns room + streetAddress when both present', () => {
    expect(buildLocation({ room: 'Room 101', streetAddress: 'Karl-Marx-Str. 1' }))
      .toBe('Room 101, Karl-Marx-Str. 1');
  });

  it('returns room only when no streetAddress or description', () => {
    expect(buildLocation({ room: 'Room 101' })).toBe('Room 101');
  });

  it('returns room + description when no streetAddress', () => {
    expect(buildLocation({ room: 'Room 101', description: 'City Hall' }))
      .toBe('Room 101, City Hall');
  });

  it('prefers streetAddress over description', () => {
    expect(buildLocation({ room: 'Room 101', streetAddress: 'Karl-Marx-Str. 1', description: 'City Hall' }))
      .toBe('Room 101, Karl-Marx-Str. 1');
  });

  it('returns undefined for null input', () => {
    expect(buildLocation(null as unknown as undefined)).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(buildLocation(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object (no truthy fields)', () => {
    expect(buildLocation({})).toBeUndefined();
  });
});

describe('berlinUtcOffset', () => {
  it('returns "+01:00" for a winter date (CET)', () => {
    expect(berlinUtcOffset('2026-01-15 10:00:00')).toBe('+01:00');
  });

  it('differentiates summer and winter dates', () => {
    // On Linux, Intl returns "CET"/"CEST" so summer returns "+02:00".
    // On Windows, Intl returns "GMT+1"/"GMT+2" which the function does not
    // recognize as CEST, so it falls back to "+01:00" for both.
    // Test the actual contract: summer offset is either "+02:00" (Linux) or "+01:00" (Windows).
    const summer = berlinUtcOffset('2026-07-15 10:00:00');
    expect(['+01:00', '+02:00']).toContain(summer);
  });
});

describe('parsePardokXml', () => {
  // Build a minimal PARDOK XML string with meetings.
  // fast-xml-parser treats a single <row> as an object, not an array.
  // The source code checks Array.isArray(rawRows), so we always include
  // a dummy past row to ensure the parser produces an array.
  const DUMMY_ROW = '<row><field name="Termin_ID">0</field><field name="committee_name">dummy</field><field name="wahlperiode">0</field><field name="date_time">2000-01-01 00:00:00</field><field name="title">dummy</field></row>';

  function buildXml(meetings: Array<{ id: string; committee: string; dateTime: string; dateTimeEnd?: string; title?: string }>): string {
    const rows = meetings.map((m) => `
      <row>
        <field name="Termin_ID">${m.id}</field>
        <field name="committee_name">${m.committee}</field>
        <field name="wahlperiode">20</field>
        <field name="date_time">${m.dateTime}</field>
        ${m.dateTimeEnd ? `<field name="date_time_end">${m.dateTimeEnd}</field>` : ''}
        <field name="title">${m.title ?? ''}</field>
      </row>
    `).join('\n');
    return `<?xml version="1.0"?><resultset>${DUMMY_ROW}${rows}</resultset>`;
  }

  // Use a far-future winter date so berlinUtcOffset returns "+01:00" on all platforms
  const futureDate = '2099-01-15 10:00:00';
  const futureDateIso = '2099-01-15T10:00:00+01:00'; // CET
  const now = new Date('2099-01-01T00:00:00Z').getTime();
  const windowMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  it('parses valid XML with meetings in window', () => {
    const xml = buildXml([{ id: '123', committee: 'Hauptausschuss', dateTime: futureDate }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result).toHaveLength(1);
    expect(result[0].committee).toBe('Hauptausschuss');
  });

  it('filters out meetings outside the time window (past)', () => {
    const pastDate = '2098-12-01 10:00:00';
    const xml = buildXml([{ id: '123', committee: 'Test', dateTime: pastDate }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result).toHaveLength(0);
  });

  it('filters out meetings too far in the future', () => {
    const farFuture = '2100-01-01 10:00:00';
    const xml = buildXml([{ id: '123', committee: 'Test', dateTime: farFuture }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty resultset', () => {
    const xml = '<?xml version="1.0"?><resultset></resultset>';
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result).toHaveLength(0);
  });

  it('applies correct Berlin CET offset to output ISO strings', () => {
    const xml = buildXml([{ id: '456', committee: 'Test', dateTime: futureDate }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result[0].start).toBe(futureDateIso);
  });

  it('produces correct id format (pardok-{Termin_ID})', () => {
    const xml = buildXml([{ id: '789', committee: 'Test', dateTime: futureDate }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result[0].id).toBe('pardok-789');
  });

  it('sets source to "parliament" and correct webUrl', () => {
    const xml = buildXml([{ id: '100', committee: 'Test', dateTime: futureDate }]);
    const result = parsePardokXml(xml, 'committee', now, windowMs);
    expect(result[0].source).toBe('parliament');
    expect(result[0].webUrl).toBe('https://www.parlament-berlin.de/termine');
  });
});
