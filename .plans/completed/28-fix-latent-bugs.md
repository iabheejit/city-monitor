# Plan 28: Fix Latent Bugs in Council Meetings Ingestion

**Type:** bugfix
**Complexity:** simple
**File:** `packages/server/src/cron/ingest-council-meetings.ts`
**Test file:** `packages/server/src/cron/ingest-council-meetings.test.ts`

## Bugs

### Bug 1: `berlinUtcOffset()` wrong on Windows

**Problem:** Line 137 checks `tz === 'CEST'` but `Intl.DateTimeFormat` returns different timezone name formats depending on the platform:
- Linux/macOS: `"CEST"` / `"CET"`
- Windows: `"GMT+2"` / `"GMT+1"`

On Windows, `berlinUtcOffset()` always returns `"+01:00"` because `"GMT+2" !== "CEST"`.

**Fix:** Instead of matching timezone abbreviation strings, compute the offset numerically. Format the date in UTC and in Europe/Berlin, then compare the difference.

Implementation:

```typescript
export function berlinUtcOffset(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  // Format hour in UTC and in Europe/Berlin, compare to get offset
  const utcHour = d.getUTCHours();
  const berlinHour = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hour12: false,
    }).format(d),
  );
  // Handle day wrap (e.g., UTC 23:00 → Berlin 01:00 next day = +2)
  const diff = ((berlinHour - utcHour) + 24) % 24;
  return diff === 2 ? '+02:00' : '+01:00';
}
```

This works on all platforms because it relies on `Intl.DateTimeFormat` for formatting a numeric hour (which is consistent) rather than timezone name strings (which vary by OS).

**Alternatives considered:**
- Check for both `"CEST"` and `"GMT+2"`: Fragile -- other platforms or locales may use yet different strings (e.g., `"UTC+2"`, `"MEZ"`).
- Parse `timeZoneName: 'longOffset'` (returns `"GMT+02:00"`): Only available in newer ICU versions, may not work on all Node builds.
- Numeric hour comparison (chosen): Robust, platform-independent, no string parsing.

### Bug 2: `parsePardokXml()` fails on single-row XML

**Problem:** Line 155 does `if (!Array.isArray(rawRows)) return [];`. When `fast-xml-parser` parses XML with exactly one `<row>` element, it returns an object instead of a single-element array. This causes the function to return `[]`, silently dropping the meeting.

**Fix:** Replace line 155 with:
```typescript
const rows = Array.isArray(rawRows) ? rawRows : rawRows ? [rawRows] : [];
```

Then iterate over `rows` instead of `rawRows`. This is the standard `fast-xml-parser` idiom for handling single-element arrays.

## Changes

### File 1: `packages/server/src/cron/ingest-council-meetings.ts`

**MOD-1** (lines 132-138): Replace `berlinUtcOffset` with numeric hour comparison.

**MOD-2** (line 155): Replace `if (!Array.isArray(rawRows)) return [];` with the normalize-to-array pattern, and update the loop on line 157 to iterate `normalizedRows` (or rename accordingly).

### File 2: `packages/server/src/cron/ingest-council-meetings.test.ts`

**MOD-3** (lines 57-70): Update `berlinUtcOffset` tests:
- The winter test stays the same (expect `"+01:00"`).
- The summer test should now assert `"+02:00"` on all platforms (not the permissive `['+01:00', '+02:00']`).
- Add a test for a date right at DST transition boundary.

**MOD-4** (lines 72-91): Update `parsePardokXml` tests:
- Remove the `DUMMY_ROW` workaround and its comment explaining the single-row bug.
- Add an explicit test: single-row XML should parse correctly (not return empty array).
- Existing multi-row tests can use `buildXml` without the dummy row padding.

## Verification

```bash
npx turbo run test --filter=@city-monitor/server -- src/cron/ingest-council-meetings.test.ts
```

All tests should pass on Windows (where the bugs manifest).
