import { describe, it, expect } from 'vitest';
import { parseAgmarknetRecords } from '../cron/ingest-mandi.js';
import { parseMgnregaRecord } from '../cron/ingest-mgnrega.js';

describe('parseAgmarknetRecords', () => {
  it('returns empty array for empty input', () => {
    expect(parseAgmarknetRecords([])).toEqual([]);
  });

  it('parses a basic commodity record', () => {
    const records = [
      {
        State: 'Maharashtra',
        District: 'Nagpur',
        Market: 'Nagpur',
        Commodity: 'Onion',
        Variety: 'Red',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '1500',
        'Max_x0020_Price': '2200',
        'Modal_x0020_Price': '1800',
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
        Commodity: 'Tomato',
        Market: 'Nagpur',
        Variety: '',
        Arrival_Date: '26/04/2025',
        'Min_x0020_Price': '800',
        'Max_x0020_Price': '1200',
        'Modal_x0020_Price': '1000',
      },
      {
        Commodity: 'Tomato',
        Market: 'Kalamna',
        Variety: '',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '900',
        'Max_x0020_Price': '1300',
        'Modal_x0020_Price': '1100',
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
        Commodity: 'Rice',
        Market: 'Nagpur',
        Variety: '',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '0',
        'Max_x0020_Price': '0',
        'Modal_x0020_Price': '0',
      },
    ];
    expect(parseAgmarknetRecords(records)).toHaveLength(0);
  });

  it('handles prices with commas', () => {
    const records = [
      {
        Commodity: 'Cotton',
        Market: 'Nagpur',
        Variety: 'Long Staple',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '6,000',
        'Max_x0020_Price': '7,500',
        'Modal_x0020_Price': '6,800',
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result[0]!.modalPrice).toBe(6800);
    expect(result[0]!.maxPrice).toBe(7500);
  });

  it('sorts by modal price descending', () => {
    const records = [
      {
        Commodity: 'Potato',
        Market: 'N',
        Variety: '',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '500',
        'Max_x0020_Price': '700',
        'Modal_x0020_Price': '600',
      },
      {
        Commodity: 'Cotton',
        Market: 'N',
        Variety: '',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '6000',
        'Max_x0020_Price': '7500',
        'Modal_x0020_Price': '6800',
      },
    ];
    const result = parseAgmarknetRecords(records);
    expect(result[0]!.name).toBe('Cotton');
    expect(result[1]!.name).toBe('Potato');
  });

  it('filters out records with no commodity name', () => {
    const records = [
      {
        Commodity: '',
        Market: 'Nagpur',
        Variety: '',
        Arrival_Date: '28/04/2025',
        'Min_x0020_Price': '500',
        'Max_x0020_Price': '700',
        'Modal_x0020_Price': '600',
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
