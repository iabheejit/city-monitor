import { describe, it, expect } from 'vitest';
import { parseNoiseSensors } from './ingest-noise-sensors.js';

// Fixtures matching the ScSensorData interface shape
function makeEntry(
  id: number,
  lat: string,
  lon: string,
  values: Array<{ value_type: string; value: string }>,
) {
  return {
    sensor: { id, sensor_type: { name: 'DNMS' } },
    location: { latitude: lat, longitude: lon },
    sensordatavalues: values,
  };
}

const VALID_ENTRY_1 = makeEntry(100, '52.5200', '13.4050', [
  { value_type: 'noise_LAeq', value: '45.67' },
  { value_type: 'noise_LA_min', value: '38.24' },
  { value_type: 'noise_LA_max', value: '62.45' },
]);

const VALID_ENTRY_2 = makeEntry(200, '53.5500', '9.9930', [
  { value_type: 'noise_LAeq', value: '51.11' },
  { value_type: 'noise_LA_min', value: '42.86' },
  { value_type: 'noise_LA_max', value: '68.93' },
]);

describe('parseNoiseSensors', () => {
  it('parses valid sensor data with correct rounding', () => {
    const result = parseNoiseSensors([VALID_ENTRY_1, VALID_ENTRY_2]);
    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      id: 100,
      lat: 52.52,
      lon: 13.405,
      laeq: 45.7,
      laMin: 38.2,
      laMax: 62.5,
    });

    expect(result[1]).toEqual({
      id: 200,
      lat: 53.55,
      lon: 9.993,
      laeq: 51.1,
      laMin: 42.9,
      laMax: 68.9,
    });
  });

  it('deduplicates by sensor id, keeping last entry', () => {
    const first = makeEntry(100, '52.5200', '13.4050', [
      { value_type: 'noise_LAeq', value: '40.0' },
    ]);
    const second = makeEntry(100, '52.5200', '13.4050', [
      { value_type: 'noise_LAeq', value: '55.0' },
    ]);
    const result = parseNoiseSensors([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].laeq).toBe(55.0);
  });

  it('skips entries with NaN laeq value', () => {
    const nanEntry = makeEntry(100, '52.52', '13.405', [
      { value_type: 'noise_LAeq', value: 'not-a-number' },
    ]);
    const result = parseNoiseSensors([nanEntry]);
    expect(result).toHaveLength(0);
  });

  it('skips entries with no laeq field at all', () => {
    const noLaeq = makeEntry(100, '52.52', '13.405', [
      { value_type: 'noise_LA_min', value: '30.0' },
    ]);
    const result = parseNoiseSensors([noLaeq]);
    expect(result).toHaveLength(0);
  });

  it('skips entries with NaN latitude or longitude', () => {
    const badLat = makeEntry(100, 'bad', '13.405', [
      { value_type: 'noise_LAeq', value: '45.0' },
    ]);
    const badLon = makeEntry(200, '52.52', 'bad', [
      { value_type: 'noise_LAeq', value: '45.0' },
    ]);
    const result = parseNoiseSensors([badLat, badLon]);
    expect(result).toHaveLength(0);
  });

  it('falls back laMin and laMax to laeq when missing', () => {
    const onlyLaeq = makeEntry(100, '52.52', '13.405', [
      { value_type: 'noise_LAeq', value: '50.3' },
    ]);
    const result = parseNoiseSensors([onlyLaeq]);
    expect(result).toHaveLength(1);
    expect(result[0].laMin).toBe(50.3);
    expect(result[0].laMax).toBe(50.3);
  });

  it('returns empty array for empty input', () => {
    const result = parseNoiseSensors([]);
    expect(result).toHaveLength(0);
  });

  it('skips entries with missing sensordatavalues', () => {
    const noValues = {
      sensor: { id: 100, sensor_type: { name: 'DNMS' } },
      location: { latitude: '52.52', longitude: '13.405' },
      sensordatavalues: undefined as unknown as Array<{ value_type: string; value: string }>,
    };
    const result = parseNoiseSensors([noValues]);
    expect(result).toHaveLength(0);
  });
});
