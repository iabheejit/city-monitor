import { describe, it, expect } from 'vitest';
import { parseAgmarknetRecords } from '../cron/ingest-mandi.js';
import { parseMgnregaRecord } from '../cron/ingest-mgnrega.js';
import { parseHmisRows } from '../cron/ingest-hmis-subdistrict.js';

describe('parseAgmarknetRecords', () => {
  it('returns empty array for empty input', () => {
    expect(parseAgmarknetRecords([])).toEqual([]);
  });

  it('parses a basic commodity record', () => {
    const records = [
      {
        state: 'Maharashtra',
        district: 'Nagpur',
        market: 'Nagpur',
        commodity: 'Onion',
        variety: 'Red',
        arrival_date: '28/04/2025',
        min_price: 1500,
        max_price: 2200,
        modal_price: 1800,
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Onion');
    expect(result[0]!.variety).toBe('Red');
    expect(result[0]!.market).toBe('Nagpur');
    expect(result[0]!.modalPrice).toBe(1800);
    expect(result[0]!.minPrice).toBe(1500);
    expect(result[0]!.maxPrice).toBe(2200);
    expect(result[0]!.arrivalDate).toBe('28/04/2025');
  });

  it('keeps only the latest arrival date per commodity', () => {
    const records = [
      {
        commodity: 'Tomato',
        market: 'Nagpur',
        variety: '',
        arrival_date: '26/04/2025',
        min_price: 800,
        max_price: 1200,
        modal_price: 1000,
      },
      {
        commodity: 'Tomato',
        market: 'Kalamna',
        variety: '',
        arrival_date: '28/04/2025',
        min_price: 900,
        max_price: 1300,
        modal_price: 1100,
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0]!.market).toBe('Kalamna');
    expect(result[0]!.modalPrice).toBe(1100);
  });

  it('filters out records with zero modal price', () => {
    const records = [
      {
        commodity: 'Rice',
        market: 'Nagpur',
        variety: '',
        arrival_date: '28/04/2025',
        min_price: 0,
        max_price: 0,
        modal_price: 0,
      },
    ];
    expect(parseAgmarknetRecords(records)).toHaveLength(0);
  });

  it('handles prices with commas', () => {
    const records = [
      {
        commodity: 'Cotton',
        market: 'Nagpur',
        variety: 'Long Staple',
        arrival_date: '28/04/2025',
        min_price: '6,000',
        max_price: '7,500',
        modal_price: '6,800',
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result[0]!.modalPrice).toBe(6800);
    expect(result[0]!.maxPrice).toBe(7500);
  });

  it('sorts by modal price descending', () => {
    const records = [
      {
        commodity: 'Potato',
        market: 'N',
        variety: '',
        arrival_date: '28/04/2025',
        min_price: 500,
        max_price: 700,
        modal_price: 600,
      },
      {
        commodity: 'Cotton',
        market: 'N',
        variety: '',
        arrival_date: '28/04/2025',
        min_price: 6000,
        max_price: 7500,
        modal_price: 6800,
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result[0]!.name).toBe('Cotton');
    expect(result[1]!.name).toBe('Potato');
  });

  it('filters out records with no commodity name', () => {
    const records = [
      {
        commodity: '',
        market: 'Nagpur',
        variety: '',
        arrival_date: '28/04/2025',
        min_price: 500,
        max_price: 700,
        modal_price: 600,
      },
    ];
    expect(parseAgmarknetRecords(records)).toHaveLength(0);
  });
});

describe('parseMgnregaRecord', () => {
  it('returns null for empty record', () => {
    expect(parseMgnregaRecord({})).toBeNull();
  });

  it('parses a valid MGNREGA record', () => {
    const record = {
      Financial_Year: '2024-2025',
      Total_Person_Days_Generated: '1,234,567',
      Total_Households_Registered: '45,678',
      Active_Workers: '23,456',
      Total_Exp_Rs_In_Lakhs: '8,901.23',
      Centre_Released_Fund_In_Lakhs: '10,000.00',
    };
    const result = parseMgnregaRecord(record);
    expect(result).not.toBeNull();
    expect(result!.financialYear).toBe('2024-2025');
    expect(result!.personDaysGenerated).toBe(1234567);
    expect(result!.jobCardsIssued).toBe(45678);
    expect(result!.activeWorkers).toBe(23456);
    expect(result!.amountSpent).toBe(890123000); // 8901.23 lakhs * 100000
    expect(result!.totalSanctioned).toBe(1000000000); // 10000 lakhs * 100000
    expect(result!.reportMonth).toBe('2024-04');
  });

  it('extracts the correct report month from financial year', () => {
    const record = { Financial_Year: '2023-2024' };
    const result = parseMgnregaRecord(record);
    expect(result!.reportMonth).toBe('2023-04');
  });

  it('handles missing optional fields gracefully', () => {
    const record = { Financial_Year: '2024-2025' };
    const result = parseMgnregaRecord(record);
    expect(result).not.toBeNull();
    expect(result!.personDaysGenerated).toBe(0);
    expect(result!.amountSpent).toBe(0);
  });
});

describe('parseHmisRows', () => {
  it('extracts TOTAL metrics per subdistrict', () => {
    const rows = [
      {
        indicator: 'Mother and Child Tracking',
        parameters: 'Total number of pregnant women registered for ANC',
        type: 'TOTAL',
        subdistrict_hingna: '100',
        subdistrict_kamptee: '75',
      },
      {
        indicator: 'Mother and Child Tracking',
        parameters: 'Out of total pregnant women registered, no. registered within first trimester',
        type: 'TOTAL',
        subdistrict_hingna: '80',
        subdistrict_kamptee: '55',
      },
      {
        indicator: 'Mother and Child Tracking',
        parameters: 'No. of PW registered under JSY',
        type: 'TOTAL',
        subdistrict_hingna: '42',
        subdistrict_kamptee: '35',
      },
      {
        indicator: 'Mother and Child Tracking',
        parameters: 'Total number of pregnant women registered for ANC',
        type: 'RURAL',
        subdistrict_hingna: '999',
      },
    ];

    const parsed = parseHmisRows('resource-123', rows);
    expect(parsed.sourceResourceId).toBe('resource-123');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({
      name: 'hingna',
      metrics: {
        pregnantRegistered: 100,
        firstTrimesterRegistered: 80,
        jsyRegistered: 42,
      },
    });
    expect(parsed.rows[1]).toEqual({
      name: 'kamptee',
      metrics: {
        pregnantRegistered: 75,
        firstTrimesterRegistered: 55,
        jsyRegistered: 35,
      },
    });
  });

  it('keeps zero values for missing metrics', () => {
    const parsed = parseHmisRows('resource-xyz', [
      {
        parameters: 'No. of PW registered under JSY',
        type: 'TOTAL',
        subdistrict_nagpur_urban: '15',
      },
    ]);

    expect(parsed.rows).toEqual([
      {
        name: 'nagpur urban',
        metrics: {
          pregnantRegistered: 0,
          firstTrimesterRegistered: 0,
          jsyRegistered: 15,
        },
      },
    ]);
  });
});
