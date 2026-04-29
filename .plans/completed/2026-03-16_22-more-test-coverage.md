# Plan 22: Add Test Coverage for 3 Untested Modules

**Type:** feature (test coverage)
**Complexity:** simple
**Date:** 2026-03-16

## Summary

Add unit tests for pure helper functions in three server modules. This requires minor export changes (adding `export` to previously-private functions) plus three test file changes (one new, two appended).

## Changes

### 1. IMP-1: `ingest-political` helper tests

**Source file:** `packages/server/src/cron/ingest-political.ts`
**Test file:** `packages/server/src/cron/ingest-political.test.ts` (NEW)

#### Export changes

Add `export` keyword to these 6 functions (lines 188, 206, 214, 230, 244, 257):
- `normalizeParty`
- `normalizeConstituencyName`
- `mandateToRepresentative`
- `filterBundestagForCity`
- `deduplicateMandates`
- `constituencyToBezirk`

No mocks needed -- all 6 are pure functions with no side effects or external dependencies. `mandateToRepresentative` calls `normalizeParty` and `normalizeConstituencyName` internally, which is fine for unit tests (test the composed behavior).

#### Test cases

**`normalizeParty`:**
- `"Fraktion der SPD"` -> `"SPD"`
- `"CDU/CSU - Fraktion"` -> `"CDU"` (CDU checked before CSU)
- `"Fraktion BÜNDNIS 90/DIE GRÜNEN"` -> `"Grüne"` (uppercase GRUNE match)
- `"Fraktion Bündnis Sahra Wagenknecht - BSW"` -> `"BSW"`
- `"Die Linke"` -> `"Die Linke"`
- `"fraktionslos"` -> `"Fraktionslos"` (case-insensitive match)
- `"Piratenpartei"` -> `"Piratenpartei"` (unknown party returns input as-is)
- `"AfD"` -> `"AfD"`

**`normalizeConstituencyName`:**
- `"78 - Berlin-Steglitz-Zehlendorf (Bundestag 2025 - 2029)"` -> `"Berlin-Steglitz-Zehlendorf"` (strips number prefix + parenthetical)
- `"Berlin-Mitte"` (no number, no parens) -> `"Berlin-Mitte"` (unchanged)
- `"3 - Charlottenburg-Wilmersdorf 1 (Abgeordnetenhaus 2023 - 2028)"` -> `"Charlottenburg-Wilmersdorf 1"`

**`mandateToRepresentative`:**
- Full mandate object with constituency -> returns `Representative` with normalized party and constituency
- Mandate with no `fraction_membership` -> party defaults to `"Parteilos"`
- Mandate with no `electoral_data.constituency` -> constituency is `undefined`

**`filterBundestagForCity`:**
- Mandates with `"Berlin"` in constituency label are kept
- Mandates with `"Berlin"` in electoral list label are kept
- Mandates with `"Hamburg"` constituency when filtering for `"Berlin"` are dropped
- Mandates with no constituency or list data are dropped
- Case-insensitive matching works (`"berlin"` in label matches city `"Berlin"`)

**`deduplicateMandates`:**
- Two mandates with same `politician.id` -> first kept, second dropped
- Three mandates, all unique politician IDs -> all kept
- Empty array -> empty array

**`constituencyToBezirk`:**
- `"Charlottenburg-Wilmersdorf 3"` -> `"Charlottenburg-Wilmersdorf"`
- `"Tempelhof-Schöneberg 1"` -> `"Tempelhof-Schöneberg"` (umlaut matching)
- `"Mitte 2"` -> `"Mitte"`
- `"Brandenburg 5"` -> `null` (not a Berlin bezirk)
- Case-insensitive: `"mitte 1"` -> `"Mitte"`

### 2. MOD-1: `applyDropLogic` direct unit tests

**Source file:** `packages/server/src/cron/ingest-feeds.ts` (already exports `applyDropLogic`)
**Test file:** `packages/server/src/cron/ingest-feeds.test.ts` (APPEND new describe block)

No source changes needed. The existing test file already has the correct mocks. Add a new `describe('applyDropLogic')` block after the existing tests.

`applyDropLogic` takes `PersistedNewsItem[]` and returns `NewsItem[]`. Import `PersistedNewsItem` from `../db/writes.js` and `applyDropLogic` from `./ingest-feeds.js`.

#### Test cases

Build minimal `PersistedNewsItem` objects (only fields that `applyDropLogic` reads: `assessment`, `importance`, plus required `NewsItem` fields like `id`, `title`, `url`, `publishedAt`, `sourceName`, `sourceUrl`, `category`, `tier`, `lang`). Use a `makeItem` helper to reduce boilerplate.

- **Items with no assessment are dropped:** item with `assessment: undefined` -> not in output
- **Items with `relevant_to_city: false` are dropped:** item with `assessment: { relevant_to_city: false, importance: 0.8 }` -> not in output
- **Passing items inherit `importance`:** item with `assessment: { relevant_to_city: true, importance: 0.9 }` -> output item has `importance: 0.9`
- **Items with no `importance` default to 0.5:** item with `assessment: { relevant_to_city: true }` (no importance key) -> output item has `importance: 0.5`
- **Mixed bag:** 4 items (no assessment, irrelevant, relevant with importance, relevant without importance) -> only 2 items in output with correct importance values

### 3. NTH-7: `stripBareCityLabel` tests

**Source file:** `packages/server/src/lib/openai.ts`
**Test file:** `packages/server/src/lib/openai.test.ts` (APPEND new describe block)

#### Export change

Add `export` to `stripBareCityLabel` on line 39:
```
export function stripBareCityLabel(...)
```

#### Test cases

Add a new `describe('stripBareCityLabel')` block. The function signature is `stripBareCityLabel(label: string | null | undefined, cityLower: string): string | undefined`. The `cityLower` param is already lowercased by callers.

- **null input:** `stripBareCityLabel(null, 'berlin')` -> `undefined`
- **undefined input:** `stripBareCityLabel(undefined, 'berlin')` -> `undefined`
- **Exact city name:** `stripBareCityLabel('Berlin', 'berlin')` -> `undefined` (stripped)
- **City name with comma prefix:** `stripBareCityLabel('Berlin, Mitte', 'berlin')` -> `undefined` (matches `cityLower + ","` startsWith)
- **City name with paren prefix:** `stripBareCityLabel('Berlin (Mitte)', 'berlin')` -> `undefined` (matches `cityLower + " ("` startsWith)
- **Legitimate sub-district label:** `stripBareCityLabel('Kreuzberg', 'berlin')` -> `'Kreuzberg'` (kept as-is)
- **City name as substring (not prefix):** `stripBareCityLabel('Ost-Berlin Museum', 'berlin')` -> `'Ost-Berlin Museum'` (not stripped, doesn't start with city name)
- **Empty string:** `stripBareCityLabel('', 'berlin')` -> `undefined` (falsy)

## Files Modified

| File | Action |
|---|---|
| `packages/server/src/cron/ingest-political.ts` | Add `export` to 6 functions |
| `packages/server/src/cron/ingest-political.test.ts` | NEW: ~120 lines |
| `packages/server/src/cron/ingest-feeds.test.ts` | APPEND: ~60 lines (new describe block) |
| `packages/server/src/lib/openai.ts` | Add `export` to `stripBareCityLabel` |
| `packages/server/src/lib/openai.test.ts` | APPEND: ~30 lines (new describe block) |

**Total files: 5** (2 modified source, 1 new test, 2 modified test)

## Implementation Notes

- All functions under test are pure (no I/O, no mocks needed) except that `mandateToRepresentative` calls the other helpers internally -- this is fine, test the composed result.
- The `ingest-political.test.ts` file needs NO mocks since we only test exported pure functions, not the cron job itself.
- For `ingest-feeds.test.ts`, the existing `vi.mock` calls at the top of the file are irrelevant to `applyDropLogic` (it does not touch DB or OpenAI), but they are already present and harmless.
- The `BERLIN_BEZIRKE` array is not exported. Rather than exporting it, hardcode the bezirk names in the test assertions for `constituencyToBezirk` -- the test should verify the function's behavior with any string array, not the specific constant.
