# Plan 15: Add Unit Tests for 4 Untested Cron Modules

**Type:** feature (test coverage)
**Complexity:** simple
**Status:** done

## Goal

Add unit tests for pure/exported functions in 4 cron modules that currently have zero test coverage:
1. `ingest-council-meetings.ts` -- `extractCommittee()`, `buildLocation()`, `parsePardokXml()`, `berlinUtcOffset()`
2. `ingest-traffic.ts` -- `toSeverity()`, `ICON_TO_TYPE` mapping
3. `ingest-nina.ts` -- `mapSeverity()`, `detectSource()`, `isDwdSource()`, `parseDashboardWarning()`
4. `ingest-pharmacies.ts` -- `parseDateTimeDE()`, `formatDateDE()`

## Approach

**Export the private helper functions** that are currently module-scoped, then test them directly via imports. This follows the established pattern used by `ingest-pollen.test.ts` (imports `parseDwdPollenJson` directly) and `ingest-wastewater.test.ts`.

The alternative of testing through the full ingestion function (mocking fetch/DB) was rejected because:
- The task explicitly says "focus only on exported pure functions; don't mock fetch or DB"
- Direct testing is simpler, faster, and more precise for pure functions
- The pollen test file already establishes this as an accepted pattern

### What to export

Each module needs a small set of functions exported (added to existing exports):

1. **ingest-council-meetings.ts**: Export `extractCommittee`, `buildLocation`, `parsePardokXml`, `berlinUtcOffset`
2. **ingest-traffic.ts**: Export `toSeverity`, `ICON_TO_TYPE`
3. **ingest-nina.ts**: Export `mapSeverity`, `detectSource`, `isDwdSource`, `parseDashboardWarning`
4. **ingest-pharmacies.ts**: Export `parseDateTimeDE`, `formatDateDE`

## Files to Create

1. `packages/server/src/cron/ingest-council-meetings.test.ts`
2. `packages/server/src/cron/ingest-traffic.test.ts`
3. `packages/server/src/cron/ingest-nina.test.ts`
4. `packages/server/src/cron/ingest-pharmacies.test.ts`

## Files to Modify

1. `packages/server/src/cron/ingest-council-meetings.ts` -- add `export` to 4 functions
2. `packages/server/src/cron/ingest-traffic.ts` -- add `export` to `toSeverity` and `ICON_TO_TYPE`
3. `packages/server/src/cron/ingest-nina.ts` -- add `export` to 4 functions
4. `packages/server/src/cron/ingest-pharmacies.ts` -- add `export` to 2 functions

## Test Cases Per Module

### 1. ingest-council-meetings.test.ts

**`extractCommittee(name)`**
- Extracts committee after "des" -- `"77. Sitzung des Ausschusses fur Bildung"` -> `"Ausschusses fur Bildung"`
- Extracts committee after "der" -- `"12. Sitzung der BVV Mitte"` -> `"BVV Mitte"`
- Returns full name when no "des/der" match -- `"Plenarsitzung"` -> `"Plenarsitzung"`
- Handles empty string

**`buildLocation(loc)`**
- Returns room + streetAddress when both present
- Returns room only when no streetAddress/description
- Returns description when no streetAddress
- Returns undefined for null/undefined input
- Returns undefined for empty object (no truthy fields)

**`parsePardokXml(xmlText, type, now, windowMs)`**
- Parses valid XML with meetings in window
- Filters out meetings outside the time window (past and too-far future)
- Returns empty array for empty/missing resultset
- Applies correct Berlin timezone offset to output ISO strings
- Produces correct `id` format (`pardok-{Termin_ID}`)
- Sets `source: 'parliament'` and correct `webUrl`

**`berlinUtcOffset(dateStr)`**
- Returns `"+01:00"` for a winter date (CET)
- Returns `"+02:00"` for a summer date (CEST)

### 2. ingest-traffic.test.ts

**`ICON_TO_TYPE` mapping**
- Maps iconCategory 1 -> `'accident'`
- Maps iconCategory 6 -> `'jam'`
- Maps iconCategory 7,8 -> `'closure'`
- Maps iconCategory 9 -> `'construction'`
- Maps unknown categories (0, 2-5, 10-14) -> `'other'`

**`toSeverity(magnitude)`**
- magnitude 4 -> `'critical'`
- magnitude 3 -> `'major'`
- magnitude 2 -> `'moderate'`
- magnitude 1, 0, negative -> `'low'`

### 3. ingest-nina.test.ts

**`mapSeverity(raw)`**
- `"Extreme"` -> `'extreme'` (case-insensitive)
- `"Severe"` -> `'severe'`
- `"Moderate"` -> `'moderate'`
- `"Minor"` and unknown strings -> `'minor'`
- `undefined`/`null` -> `'minor'`

**`detectSource(id)`**
- `"mow.xxx"` -> `'mowas'`
- `"biwapp.xxx"` -> `'biwapp'`
- `"katwarn.xxx"` -> `'katwarn'`
- `"dwd.xxx"` -> `'dwd'`
- `"lhp.xxx"` -> `'lhp'`
- `"police.xxx"` -> `'police'`
- Unknown prefix -> `'mowas'` (default)

**`isDwdSource(warning)`**
- Returns true for id starting with `"dwd."`
- Returns true for type containing `"dwd"` (case-insensitive)
- Returns false for non-DWD warnings

**`parseDashboardWarning(raw)`**
- Parses a valid dashboard warning into NinaWarning
- Returns null when headline (i18nTitle.de) is missing

### 4. ingest-pharmacies.test.ts

**`parseDateTimeDE(date, time)`**
- `("01.03.2026", "18:00")` -> `"2026-03-01T18:00:00"`
- `("25.12.2026", "")` -> `"2026-12-25T00:00:00"` (empty time defaults)

**`formatDateDE(date)`**
- Formats a Date into `"DD.MM.YYYY"` string
- Pads single-digit days and months with leading zero

## Implementation Notes

- All test files use `import { describe, it, expect } from 'vitest'` (no `vi` needed since no mocking)
- `parsePardokXml` is the most complex -- it needs real XML input strings. Use `fast-xml-parser` format since that is what the function expects internally. The test should construct minimal valid XML matching the PARDOK schema.
- For `berlinUtcOffset`, use known CET/CEST dates (e.g., January for CET, July for CEST). Note: this relies on `Intl.DateTimeFormat` which works in Node.
- Run tests with: `npx turbo run test --filter=@city-monitor/server`
