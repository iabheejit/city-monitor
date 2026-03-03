/**
 * Copyright (C) 2026 Odin Mühlenbein
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { parseBudgetCsv, aggregateBudgetData, splitCsvRow } from './ingest-budget.js';

const HEADER = 'ID;Typ;Bezeichnung;Bereich;Bereichsbezeichnung;Einzelplan;Einzelplanbezeichnung;Kapitel;Kapitelbezeichnung;Hauptgruppe;Hauptgruppenbezeichnung;Obergruppe;Obergruppenbezeichnung;Gruppe;Gruppenbezeichnung;Hauptfunktion;Hauptfunktionsbezeichnung;Oberfunktion;Oberfunktionsbezeichnung;Funktion;Funktionsbezeichnung;Titelart;Titel;Titelbezeichnung;Jahr;BetragTyp;Betrag';

function row(overrides: {
  bereich?: string;
  bereichName?: string;
  hauptfunktion?: string;
  hauptfunktionName?: string;
  titelart?: string;
  jahr?: string;
  betragTyp?: string;
  betrag?: string;
}): string {
  const b = overrides.bereich ?? '30';
  const bn = overrides.bereichName ?? 'Hauptverwaltung';
  const hf = overrides.hauptfunktion ?? '1';
  const hfn = overrides.hauptfunktionName ?? 'Bildungswesen, Wissenschaft, Forschung, kulturelle Angelegenheiten';
  const ta = overrides.titelart ?? 'Ausgabetitel';
  const j = overrides.jahr ?? '2026';
  const bt = overrides.betragTyp ?? 'Soll';
  const amt = overrides.betrag ?? '1000000';
  return `1;2;X;${b};${bn};01;EP;0100;Kap;5;HG;52;OG;526;G;${hf};${hfn};01;OF;011;F;${ta};52601;Titel;${j};${bt};${amt}`;
}

describe('parseBudgetCsv', () => {
  it('parses semicolon-delimited rows correctly', () => {
    const csv = [HEADER, row({})].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bereich: 30,
      bereichName: 'Hauptverwaltung',
      hauptfunktion: 1,
      titelart: 'Ausgabetitel',
      jahr: 2026,
      betrag: 1000000,
    });
  });

  it('strips UTF-8 BOM', () => {
    const csv = '\uFEFF' + [HEADER, row({})].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it('filters to year 2026 and BetragTyp Soll only', () => {
    const csv = [
      HEADER,
      row({ jahr: '2026', betragTyp: 'Soll', betrag: '100' }),
      row({ jahr: '2027', betragTyp: 'Soll', betrag: '200' }),
    ].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.betrag).toBe(100);
  });

  it('skips rows with non-numeric Bereich', () => {
    const csv = [HEADER, row({ bereich: '' })].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(0);
  });

  it('handles quoted fields with embedded semicolons', () => {
    // Column 23 (Titelbezeichnung) contains a quoted value with semicolons
    const line = `1;2;X;31;Mitte;01;EP;0100;Kap;5;HG;52;OG;526;G;1;Education;01;OF;011;F;Ausgabetitel;52601;"Schule; Hinterhaus; 2. BA";2026;Soll;500000`;
    const csv = [HEADER, line].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.betrag).toBe(500000);
    expect(rows[0]!.bereichName).toBe('Mitte');
  });

  it('handles multi-line quoted fields', () => {
    const line = `1;2;X;31;Mitte;01;EP;0100;Kap;5;HG;52;OG;526;G;1;Education;01;OF;011;F;Ausgabetitel;52601;"Schule\nNeubau";2026;Soll;300000`;
    const csv = [HEADER, line].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.betrag).toBe(300000);
  });

  it('handles decimal amounts with German comma notation', () => {
    const csv = [HEADER, row({ betrag: '1234567,89' })].join('\n');
    const rows = parseBudgetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.betrag).toBeCloseTo(1234567.89);
  });
});

describe('splitCsvRow', () => {
  it('splits simple semicolon-delimited fields', () => {
    expect(splitCsvRow('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with embedded semicolons', () => {
    expect(splitCsvRow('a;"b;c";d')).toEqual(['a', 'b;c', 'd']);
  });

  it('handles escaped quotes', () => {
    expect(splitCsvRow('a;"b""c";d')).toEqual(['a', 'b"c', 'd']);
  });
});

describe('aggregateBudgetData', () => {
  it('aggregates expenses by area and category', () => {
    const csv = [
      HEADER,
      row({ bereich: '31', bereichName: 'Mitte', hauptfunktion: '1', hauptfunktionName: 'Education', titelart: 'Ausgabetitel', betrag: '5000000' }),
      row({ bereich: '31', bereichName: 'Mitte', hauptfunktion: '1', hauptfunktionName: 'Education', titelart: 'Ausgabetitel', betrag: '3000000' }),
      row({ bereich: '31', bereichName: 'Mitte', hauptfunktion: '2', hauptfunktionName: 'Social', titelart: 'Ausgabetitel', betrag: '2000000' }),
    ].join('\n');

    const rows = parseBudgetCsv(csv);
    const summary = aggregateBudgetData(rows);

    // Should have "Berlin (Total)" + Mitte
    expect(summary.areas).toHaveLength(2);

    const mitte = summary.areas.find((a) => a.areaCode === 31);
    expect(mitte).toBeDefined();
    expect(mitte!.totalExpense).toBe(10_000_000);
    expect(mitte!.expenses).toHaveLength(2);

    const edu = mitte!.expenses.find((e) => e.code === 1);
    expect(edu!.amount).toBe(8_000_000);
  });

  it('separates revenues and expenses', () => {
    const csv = [
      HEADER,
      row({ bereich: '30', bereichName: 'Hauptverwaltung', titelart: 'Einnahmetitel', betrag: '9000000' }),
      row({ bereich: '30', bereichName: 'Hauptverwaltung', titelart: 'Ausgabetitel', betrag: '10000000' }),
    ].join('\n');

    const rows = parseBudgetCsv(csv);
    const summary = aggregateBudgetData(rows);

    const total = summary.areas.find((a) => a.areaCode === -1);
    expect(total).toBeDefined();
    expect(total!.totalRevenue).toBe(9_000_000);
    expect(total!.totalExpense).toBe(10_000_000);
  });

  it('creates a Berlin (Total) row summing all areas', () => {
    const csv = [
      HEADER,
      row({ bereich: '30', bereichName: 'Hauptverwaltung', titelart: 'Ausgabetitel', betrag: '1000' }),
      row({ bereich: '31', bereichName: 'Mitte', titelart: 'Ausgabetitel', betrag: '2000' }),
    ].join('\n');

    const rows = parseBudgetCsv(csv);
    const summary = aggregateBudgetData(rows);

    const total = summary.areas.find((a) => a.areaCode === -1);
    expect(total!.totalExpense).toBe(3000);
    expect(total!.areaName).toBe('Berlin (Total)');
  });

  it('sorts expenses descending by amount', () => {
    const csv = [
      HEADER,
      row({ hauptfunktion: '0', hauptfunktionName: 'General', titelart: 'Ausgabetitel', betrag: '100' }),
      row({ hauptfunktion: '1', hauptfunktionName: 'Education', titelart: 'Ausgabetitel', betrag: '300' }),
      row({ hauptfunktion: '2', hauptfunktionName: 'Social', titelart: 'Ausgabetitel', betrag: '200' }),
    ].join('\n');

    const rows = parseBudgetCsv(csv);
    const summary = aggregateBudgetData(rows);
    const total = summary.areas.find((a) => a.areaCode === -1)!;

    expect(total.expenses[0]!.code).toBe(1);
    expect(total.expenses[1]!.code).toBe(2);
    expect(total.expenses[2]!.code).toBe(0);
  });
});
