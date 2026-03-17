# Improvement Opportunities — Cycle 2
**Date:** 2026-03-16
**Scope:** `packages/web/src/components/` (map/, layout/, strips/), `packages/server/src/cron/`, `packages/server/src/lib/`, `shared/types.ts`. Focus on `any` types, dead/duplicate code, error handling gaps, and test coverage gaps. Areas already addressed in cycle 1 are excluded.

---

## Scoping Notes
- `node_modules/`, `dist/`, and generated files excluded.
- Automated checks ran: `npm run typecheck` (clean), `npm run lint` (1 error), `npx turbo run test` (6 failing tests in `App.test.tsx` due to missing `ResizeObserver` mock, all server tests pass).
- Previous cycle addressed: console.error in CityMap, isDesktop hook, DB query limits, parallelization, news type dedup, rate limits, OpenAI tracking, CI cache, route tests, district config, geocode token, saveSnapshot guard, documentation comments, ko-fi config.

---

## Critical

### C1 — Lint error: unused import `NewsItem` in `packages/web/src/lib/api.ts`
**File:** `packages/web/src/lib/api.ts` line 12
**Problem:** `NewsItem` is imported via `import type { ..., NewsItem, ... }` on line 12, but it is re-exported on line 11 via `export type { ..., NewsItem }` directly from `@city-monitor/shared`. The second `import` on line 12 is thus dead — the linter reports it as an error that blocks the entire `npm run lint` run and therefore CI.
**Fix:** Remove `NewsItem` and `NewsDigest` from the `import type` on line 12 (they are already covered by the `export type` on line 11). The `import type` on line 12 is only needed for types that are used internally (e.g., in the `BootstrapData` interface), and `NewsItem` is not used internally on that line.

---

## Important

### I1 — `App.test.tsx` — 6 tests fail due to missing `ResizeObserver` mock
**File:** `packages/web/src/App.test.tsx`, `packages/web/src/test-setup.ts`
**Problem:** `Shell.tsx` uses `new ResizeObserver(...)` to measure the TopBar height. jsdom does not implement `ResizeObserver`, so when `App.test.tsx` renders the full `<App />` tree, the component crashes with "ResizeObserver is not defined" before the `<Footer />` can render. All 6 tests in the file fail because the `waitFor` times out seeing a rendered error boundary instead of the expected content.
**Fix:** Add `global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));` to `packages/web/src/test-setup.ts`, which already mocks `matchMedia` and `maplibre-gl`. This one line unblocks all 6 tests.

### I2 — Type duplication: `NinaWarning`, `TrafficIncident`, `EmergencyPharmacy`, `Representative`, `PoliticalDistrict`, `AirQuality` defined locally in `api.ts` but also exist (or partially exist) in `shared/types.ts`
**File:** `packages/web/src/lib/api.ts` lines 77–150
**Problem:** `NinaWarning` (lines 77–90), `TrafficIncident` (125–138), `EmergencyPharmacy` (140–150), `Representative` (109–116), and `PoliticalDistrict` (118–122) are all fully redefined locally in `api.ts`. These exact interfaces already exist in `shared/types.ts` — they were never migrated when shared types were expanded. The local `AirQuality` type (lines 92–107) is the only one that has no counterpart in shared and should stay local. The duplication creates a maintenance hazard: divergence will silently appear if either copy is updated.
**Fix:** Delete the five locally-defined interfaces and replace each with re-exports from `@city-monitor/shared` (adding them to the existing `export type { ... } from '@city-monitor/shared'` line on line 152). `TrafficIncident` in `shared/types.ts` has `road?: string | null` while the local copy has `road?: string` — verify and align the nullability before deleting.

### I3 — Missing test file for `ingest-noise-sensors.ts` (exported `parseNoiseSensors` function has no tests)
**File:** `packages/server/src/cron/ingest-noise-sensors.ts`
**Problem:** `parseNoiseSensors` is exported and contains non-trivial logic: it deduplicates by sensor ID via a Map, handles missing `laMin`/`laMax` by falling back to `laeq`, skips sensors with NaN `laeq`, skips sensors with NaN lat/lon, and rounds to one decimal place. There is no test file for this module. Unlike most other cron modules, the pure parsing function is easy to unit test without fetch mocks.
**Fix:** Create `packages/server/src/cron/ingest-noise-sensors.test.ts` covering: (a) normal parse, (b) deduplication of repeated sensor IDs, (c) graceful skip of entries with NaN laeq, (d) `laMin`/`laMax` fallback to `laeq` when those fields are missing.

### I4 — Missing test files for `ingest-council-meetings.ts`, `ingest-traffic.ts`, `ingest-nina.ts`, and `ingest-pharmacies.ts`
**Files:** `packages/server/src/cron/` (four files without test counterparts)
**Problem:** These four ingestion modules have no corresponding `.test.ts` files. Each has testable pure-logic functions or important branching:
- `ingest-council-meetings.ts`: `extractCommittee()`, `buildLocation()`, `parsePardokXml()`, `berlinUtcOffset()` — all pure and testable.
- `ingest-traffic.ts`: `toSeverity()` and the `ICON_TO_TYPE` mapping are pure.
- `ingest-nina.ts`: severity normalisation and the detail-fetch guard logic.
- `ingest-pharmacies.ts`: address formatting and phone parsing logic.
All other cron modules in the directory have tests (`ingest-safety`, `ingest-feeds`, `ingest-weather`, etc.).
**Fix:** Create test files for each, targeting the pure/exported functions using the existing pattern (vi.mock for fetch, createCache, no DB required).

### I5 — `spider.ts` uses `any` type with suppression comments; typing is feasible
**File:** `packages/web/src/components/map/spider.ts` lines 17–18, 135–136
**Problem:** `SpiderHandlerSet.handlers` is typed as `Array<{ event: string; layer?: string; fn: any }>` with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`. The `any` is needed because `map.on` accepts different callback signatures. However a narrower `(...args: unknown[]) => void` or a union of the specific maplibre callback types would eliminate the suppression and make the handler array properly typed.
**Fix:** Replace `fn: any` with `fn: (...args: unknown[]) => void` and update the cast sites in `cleanupSpiderHandlers` and `addSpiderHandler`. The two eslint-disable comments can then be removed.

---

## Moderate

### M1 — `ingest-safety.ts` cities loop is sequential; could be parallelised like `ingest-feeds.ts`
**File:** `packages/server/src/cron/ingest-safety.ts` lines 27–37
**Problem:** The safety ingestion iterates cities with `for...of` (sequential). `ingest-feeds.ts` already demonstrates the pattern of using `Promise.allSettled(cities.map(...))` for parallel city processing. For a single-city deployment this is a no-op, but it creates inconsistency in the codebase and would slow things down once more cities are active.
**Fix:** Replace the sequential `for...of` loop with `Promise.allSettled(cities.map(...))` as done in `ingest-feeds.ts`.

### M2 — `data-retention.ts` runs all DELETE tasks sequentially; could be parallelised
**File:** `packages/server/src/cron/data-retention.ts` lines 90–99
**Problem:** The 28 delete tasks (24 snapshot types + 4 non-snapshot tables) run in a `for...of` loop sequentially. Each is an independent `DELETE ... WHERE` with no ordering dependency. Running them in parallel batches would cut retention time significantly.
**Fix:** Replace the sequential loop with `Promise.allSettled(tasks.map(t => t.fn()))` and accumulate the `cleaned` count from the settled results.

### M3 — `CityMap.tsx` district-layer rebuild is duplicated between `style.load` handler and `politicalActive` effect
**File:** `packages/web/src/components/map/CityMap.tsx` lines 374–409 and lines 660–759
**Problem:** The code that adds `district-fill`, `district-line`, and `district-label` layers to the map is copy-pasted in two places: once inside the `style.load` handler (the theme-change effect, lines 374–409) and once in the `politicalActive` effect (lines 700–740). The paint and layout options are identical strings in both branches. If one needs to change (e.g., label font), the other will be missed.
**Fix:** Extract the shared "add district layers from a resolved GeoJSON + nameField" logic into a helper function in `packages/web/src/components/map/layers/political.ts` (which already owns `addDistrictLayer`, `ensureDistrictLabelsBelow`). Both call sites become a single function call.

### M4 — `openai.ts` city-name deduplication logic for location labels is duplicated in `filterAndGeolocateNews` and `geolocateReports`
**File:** `packages/server/src/lib/openai.ts` lines 250–255 and 342–347
**Problem:** The block that strips bare city-name `locationLabel` values (e.g., "Berlin" or "Berlin (city)") appears twice, character-for-character:
```ts
const lower = label.toLowerCase().trim();
if (lower === cityLower || lower.startsWith(cityLower + ',') || lower.startsWith(cityLower + ' (')) {
  label = undefined;
}
```
If the logic needs to change (e.g., add "berlin, germany"), both copies must be updated in sync.
**Fix:** Extract into a small private helper `stripBareCityLabel(label: string, cityLower: string): string | undefined` and call it from both locations.

### M5 — `summarize.ts` headline hash uses only top-5 sorted titles; jitter between cycles can cause unnecessary re-summarisation
**File:** `packages/server/src/cron/summarize.ts` lines 62–68
**Problem:** The cache-dedup key is built from `topItems.slice(0, 5).map(i => i.title).sort().join('|')`. The sort is correct, but using only 5 headlines means a small change in the top-5 (e.g., a new crime report pushing out a cultural event) forces a fresh LLM call even if the high-importance news is unchanged. A larger window (e.g., top-10 headlines) would reduce unnecessary summarisation calls, cutting costs.
**Fix:** Increase the key headline window from 5 to 10 (or make it a named constant `HASH_HEADLINE_COUNT = 10`). This is a tuning change with no behavioural side effects.

### M6 — `ingest-council-meetings.ts` silently discards past meetings without logging; `anyInFuture` guard may prematurely halt pagination
**File:** `packages/server/src/cron/ingest-council-meetings.ts` lines 90–122
**Problem:** When the OParl API returns meetings sorted newest-first, the code stops paginating when `anyInFuture` is false (i.e., all meetings on a page are in the past). However, if the API returns pages in ascending-date order (oldest first), this guard prematurely halts after the first page. The comment says "newest-first" but OParl 1.0 does not mandate a sort order, and different ALLRIS instances may differ.
**Fix:** Add a `log.warn` when zero meetings are found for a district after full pagination (currently the code logs only successes). Also consider relaxing the early-exit guard to `pages >= 3` (already there) without relying on date ordering assumptions.

### M7 — `packages/web/src/components/strips/NewsStrip.tsx`: `displayItems` is a redundant slice of `filteredItems`
**File:** `packages/web/src/components/strips/NewsStrip.tsx` lines 79–83 and 101
**Problem:** `filteredItems` (line 79) already slices to `MAX_ITEMS` (15). Then `displayItems` on line 101 slices `filteredItems` to `MAX_ITEMS` again — a double slice that always produces the same result. This is dead code.
**Fix:** Remove the `displayItems` variable and use `filteredItems` directly on line 130. Also remove the `const displayItems = filteredItems.slice(0, MAX_ITEMS);` line.

---

## Nice-to-Have

### N1 — `shared/types.ts` is missing `CityEvent`, `SafetyReport`, and `AirQuality` types; these live only in `api.ts` or ingestion files
**Problem:** `CityEvent` is defined in `packages/server/src/cron/ingest-events.ts` and mirrored in `packages/web/src/lib/api.ts`. `SafetyReport` is defined only in `ingest-safety.ts`. `AirQuality` (the polling endpoint shape) is only in `api.ts`. Moving them to `shared/types.ts` would complete the consolidation started by cycle 1's dedup work.

### N2 — `geocode.ts` in-process cache (`geocodeCache`) is unbounded; could grow without limit in long-running server
**File:** `packages/server/src/lib/geocode.ts` line 106
**Problem:** `const geocodeCache = new Map<string, GeocodeResult | null>()` has no size cap or eviction. In theory geocode keys are stable landmarks and grow slowly, but over months of operation the Map could grow to thousands of entries. Adding a simple LRU cap (e.g., `MAX_ENTRIES = 10_000`) with eviction of the oldest entry when the cap is hit would prevent unbounded growth.

### N3 — `Tile.tsx` uses `window.matchMedia('(prefers-reduced-motion: reduce)')` without a try/catch; could throw in SSR or unusual environments
**File:** `packages/web/src/components/layout/Tile.tsx` line 44
**Problem:** `window.matchMedia(...).matches` is called synchronously during render. jsdom supports it (via the test-setup mock) and browsers always have it. However, a defensive guard (`typeof window !== 'undefined' && window.matchMedia` already exists) is present, so this is low risk. The `.matches` property read is inside the guard. This is a cosmetic concern.

### N4 — `ingest-feeds.ts`: `applyDropLogic` spreads and then immediately re-adds `importance` from the assessment; slightly convoluted
**File:** `packages/server/src/cron/ingest-feeds.ts` lines 291–302
**Problem:** The function destructures `assessment` out of each item to produce the clean `NewsItem`, then re-reads `assessment?.importance` to set `importance`. This is correct but the intent is slightly obscured. A small comment or rename (`const { assessment: _a, ...rest } = item`) would clarify.

### N5 — `CityMap.tsx` is 843 lines; the political layer effects (lines 647–831) could be extracted to a custom hook
**File:** `packages/web/src/components/map/CityMap.tsx`
**Problem:** The three political effects (GeoJSON swap, styling, popup) plus the supporting refs total ~185 lines inside an already large component. They form a coherent sub-system. Extracting them to `usePoliticalMapLayer(mapRef, ...)` would cut the component to ~660 lines and make the logic independently testable.

### N6 — `console.warn('[political] GeoJSON swap error:', e)` in `CityMap.tsx` should use the `log` pattern from server-side code
**File:** `packages/web/src/components/map/CityMap.tsx` line 754
**Problem:** This is the one remaining direct `console.warn` in `CityMap.tsx`. The previous cycle removed `console.error` calls. The web package does not have a structured logger, but at minimum the message could be improved by using `console.warn` without the square-bracket prefix (which is a server logging convention) or a thin frontend logger utility could be introduced.

### N7 — `APONET_TOKEN` in `ingest-pharmacies.ts` is a hardcoded public widget token with a comment saying it may be revoked
**File:** `packages/server/src/cron/ingest-pharmacies.ts` lines 19–20
**Problem:** The token `216823d96ea25c051509d935955c130fbc72680fc1d3040fe3e8ca0e25f9cd02` is hardcoded as a fallback. The comment acknowledges it may be revoked. If revoked, pharmacy ingestion silently stops working with no alert. Consider adding a startup warning log if `APONET_TOKEN` is not set as an env var (relying on the hardcoded fallback), so operators know they should supply their own token.

---

## Summary Table

| # | Priority | File(s) | Description |
|---|----------|---------|-------------|
| C1 | Critical | `web/src/lib/api.ts` | Unused `NewsItem` import breaks lint/CI |
| I1 | Important | `web/src/test-setup.ts` | Missing `ResizeObserver` mock; 6 App tests fail |
| I2 | Important | `web/src/lib/api.ts`, `shared/types.ts` | 5 types duplicated between api.ts and shared/types.ts |
| I3 | Important | `server/src/cron/ingest-noise-sensors.ts` | No tests for exported `parseNoiseSensors` |
| I4 | Important | `server/src/cron/` (4 files) | No tests for council-meetings, traffic, nina, pharmacies |
| I5 | Important | `web/src/components/map/spider.ts` | `any` type with eslint-suppress; narrower type feasible |
| M1 | Moderate | `server/src/cron/ingest-safety.ts` | Sequential city loop vs parallel in ingest-feeds |
| M2 | Moderate | `server/src/cron/data-retention.ts` | 28 sequential DELETEs could be parallelised |
| M3 | Moderate | `web/src/components/map/CityMap.tsx` | District layer add logic duplicated in two effects |
| M4 | Moderate | `server/src/lib/openai.ts` | City-name label strip logic duplicated twice |
| M5 | Moderate | `server/src/cron/summarize.ts` | Hash key uses only 5 headlines; tuning opportunity |
| M6 | Moderate | `server/src/cron/ingest-council-meetings.ts` | `anyInFuture` guard relies on sort order assumption |
| M7 | Moderate | `web/src/components/strips/NewsStrip.tsx` | Double slice — `displayItems` is redundant dead code |
| N1 | Nice-to-have | `shared/types.ts` | `CityEvent`, `SafetyReport`, `AirQuality` not in shared |
| N2 | Nice-to-have | `server/src/lib/geocode.ts` | Unbounded in-process geocode cache |
| N3 | Nice-to-have | `web/src/components/layout/Tile.tsx` | matchMedia call cosmetically unguarded |
| N4 | Nice-to-have | `server/src/cron/ingest-feeds.ts` | `applyDropLogic` slightly convoluted but correct |
| N5 | Nice-to-have | `web/src/components/map/CityMap.tsx` | Political effects could be extracted to a hook |
| N6 | Nice-to-have | `web/src/components/map/CityMap.tsx` | Remaining `console.warn` with server-style bracket prefix |
| N7 | Nice-to-have | `server/src/cron/ingest-pharmacies.ts` | Hardcoded fallback token should emit startup warning |
