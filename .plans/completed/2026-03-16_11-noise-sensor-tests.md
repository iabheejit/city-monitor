# Plan: Unit Tests for `parseNoiseSensors`

**Type:** feature (tests)
**Complexity:** simple
**Files affected:** 1 (new file)

## Goal

Add unit tests for the exported `parseNoiseSensors` function in `packages/server/src/cron/ingest-noise-sensors.ts`.

## File to Create

`packages/server/src/cron/ingest-noise-sensors.test.ts`

## Approach

Follow the pattern established by `ingest-pollen.test.ts` and other cron test files:
- Import from vitest (`describe`, `it`, `expect`)
- Import the function under test with `.js` extension
- Define sample `ScSensorData`-shaped fixtures inline (no external fixture files)
- Pure function tests only -- no mocking needed since `parseNoiseSensors` is a pure transformer

Since `ScSensorData` is not exported, fixtures will use plain objects matching the interface shape. TypeScript will accept them since the function parameter is typed.

## Test Cases

### (a) Normal parse with valid sensor data
- Provide 2 entries with valid `noise_LAeq`, `noise_LA_min`, `noise_LA_max` values
- Assert correct `id`, `lat`, `lon`, `laeq`, `laMin`, `laMax` on each result
- Verify values are rounded to 1 decimal place (e.g., `45.67` -> `45.7`)
- Assert result length is 2

### (b) Deduplication of repeated sensor IDs
- Provide 2 entries with the same `sensor.id` but different values
- Assert result length is 1
- Assert the kept entry is the **last** one (Map.set overwrites)

### (c) Graceful skip of entries with NaN laeq
- Provide entry where `noise_LAeq` value is `"not-a-number"`
- Provide entry where `noise_LAeq` is missing entirely from `sensordatavalues`
- Assert both are skipped (result length 0 or only valid entries remain)
- Also test: entry with missing/NaN lat/lon is skipped

### (d) laMin/laMax fallback to laeq when fields are missing
- Provide entry with only `noise_LAeq` (no min/max fields)
- Assert `laMin` and `laMax` both equal `laeq`

### Additional edge cases
- **Empty array input** returns empty array
- **Missing `sensordatavalues`** (undefined) does not throw, entry is skipped

## Sample Fixture Shape

```ts
const validEntry = {
  sensor: { id: 100, sensor_type: { name: 'DNMS' } },
  location: { latitude: '52.5200', longitude: '13.4050' },
  sensordatavalues: [
    { value_type: 'noise_LAeq', value: '45.67' },
    { value_type: 'noise_LA_min', value: '38.20' },
    { value_type: 'noise_LA_max', value: '62.41' },
  ],
};
```

## Run Command

```bash
npx turbo run test --filter=@city-monitor/server -- src/cron/ingest-noise-sensors.test.ts
```
