# Improvement Opportunities — Cycle 4
**Date:** 2026-03-16
**Scope:** Full codebase, final pass. All 13 lenses applied. Focus on anything missed after 3 cycles.
**Scoping decisions:** Skipped `.git/`, `node_modules/`, `dist/`, generated files, migration SQL files. Examined all server cron jobs, routes, lib utilities, DB layer, frontend strips, hooks, map layers, and shared types.

---

## Already Addressed (cycles 1–3, not re-reported)
See task prompt for the full exclusion list covering ~50 items.

---

## Critical

*(No critical-severity findings. No unhandled data corruption, security vulnerabilities, or runtime crashes found.)*

---

## Important

### IMP-1: `ingest-political.ts` has no unit tests for its pure helper functions
**File:** `packages/server/src/cron/ingest-political.ts`
**Issue:** This file contains six pure, testable helper functions — `normalizeParty`, `normalizeConstituencyName`, `mandateToRepresentative`, `filterBundestagForCity`, `deduplicateMandates`, and `constituencyToBezirk` — but there is no `ingest-political.test.ts`. The council-meetings, nina, noise-sensors, and transit cron jobs all have similar parsers that are now tested. The political helpers contain non-trivial string manipulation (regex stripping of parenthetical terms, constituency prefix matching) that is prone to breakage when the abgeordnetenwatch API changes its label format. For example, `normalizeConstituencyName` strips `"78 - Berlin-Steglitz-Zehlendorf (Bundestag 2025 - 2029)"` down to `"Berlin-Steglitz-Zehlendorf"` — a regression here silently corrupts district grouping.
**Fix:** Create `ingest-political.test.ts`. Export the six helpers (currently unexported private functions), then write cases for: party normalization edge cases, constituency label stripping, duplicate politician IDs, Berlin constituency-to-bezirk matching.

### IMP-2: `weather-tiles.ts` route has no test and uses module-level mutable state
**File:** `packages/server/src/routes/weather-tiles.ts`
**Issue:** `createWeatherTilesRouter()` stores `radarPath` and `refreshTimer` as module-level mutable variables and immediately fires a network request (`refreshRadarPath()`) on import. This makes the module untestable without mocking the global `fetch`, and also means calling `createWeatherTilesRouter()` twice (or in tests) fires duplicate background timers. Every other route is stateless; the radar path could instead be stored inside the closure returned by the factory function.
**Fix:** Move `radarPath` and `refreshTimer` inside `createWeatherTilesRouter()` so each invocation gets its own isolated state. Add a basic route test verifying 503 when `radarPath` is null, 400 for invalid coordinates, and forwarding of the upstream image.

### IMP-3: `warm-cache.ts` Berlin-only block uses hardcoded `'berlin'` instead of `cityId`
**File:** `packages/server/src/db/warm-cache.ts:134–174`
**Issue:** The guard `cityId === 'berlin'` is correct, but within the guarded block all DB loads and cache sets pass the string literal `'berlin'` rather than the variable `cityId`. If a second Berlin-like city were added (e.g., `'berlin-test'`), the block would run but all its data would go to the wrong cache keys. This is inconsistent with the rest of `warmCity` which always uses `cityId`.
**Fix:** Replace every hardcoded `'berlin'` string inside the conditional block with `cityId`, matching the pattern used by all other warm tasks.

### IMP-4: `console.warn` used directly in `CityMap.tsx` instead of the project logger
**File:** `packages/web/src/components/map/CityMap.tsx:700`
**Issue:** A single `console.warn('[political] GeoJSON swap error:', e)` appears in the political layer effect inside the `CityMap` component. All server code uses the `createLogger` abstraction, and all other web error paths either swallow the error silently or bubble it to the React error boundary. This raw `console.warn` will appear in production browser devtools and is inconsistent.
**Fix:** Replace with a silent catch (`/* ignore */`) since the swap failure already falls back to the default district layer on the next line, or convert the log message into a no-op comment explaining the fallback. Do not introduce a new logger dependency in the map component.

---

## Moderate

### MOD-1: `applyDropLogic` in `ingest-feeds.ts` is untested
**File:** `packages/server/src/cron/ingest-feeds.ts:290–302`
**Issue:** `applyDropLogic` is exported and shared by three callers (`ingest-feeds`, `warm-cache`, `news route`), but the existing `ingest-feeds.test.ts` does not directly test this function. It exercises it only indirectly through the full ingestion path with LLM mocked to return null (which causes all items to be dropped trivially). The function's edge cases — items with `relevant_to_city: false`, items with no assessment, items where `assessment.importance` is missing — are not explicitly covered.
**Fix:** Add direct unit tests for `applyDropLogic` in `ingest-feeds.test.ts`: items with no assessment are dropped; items with `relevant_to_city: false` are dropped; passing items inherit `importance`; items with no `importance` default to `0.5`.

### MOD-2: `isDwdSource` function in `ingest-nina.ts` has a logic error in the third condition
**File:** `packages/server/src/cron/ingest-nina.ts:118–122`
**Issue:** The third branch of `isDwdSource` is:
```
warning.transKeys?.event?.startsWith('BBK-EVC-0') === false && warning.id?.includes('.dwd.') === true
```
The intent is to catch DWD warnings routed through a BBK event code. However the condition `startsWith('BBK-EVC-0') === false` is always true when `transKeys?.event` is `undefined` (since `undefined === false` is false — actually it evaluates as `undefined.startsWith` would throw but optional chaining makes it `undefined`, and `undefined === false` is `false`). The overall expression evaluates to `false` when the field is absent — which is fine — but the logic is misleading and the unit test in `ingest-nina.test.ts` only tests the DWD prefix case. The condition would also mis-identify any non-BBK-EVC-0 event with `.dwd.` in its ID as a DWD source even if it is not.
**Fix:** Simplify to just the two prefix checks: `id.startsWith('dwd.')` and `type.toLowerCase().includes('dwd')`, removing the confusing third branch, and add a test for the `.dwd.` mid-ID pattern.

### MOD-3: `CouncilMeetingsStrip` uses string type alias `MeetingFilter = string` instead of a proper union
**File:** `packages/web/src/components/strips/CouncilMeetingsStrip.tsx:47`
**Issue:** `type MeetingFilter = string` provides no type safety. The filter is either the constant `PARLIAMENT_KEY = 'parliament'` or a district name string. All other comparable state in the codebase uses proper string literal unions (e.g., `View`, `Tab`, `DataLayer`). The `useState<MeetingFilter>` and the `setFilter` callback accept any string.
**Fix:** This could be tightened at the type level (e.g., a discriminated union or a branded type), but since district names are dynamic at runtime, the simplest fix is a comment explaining the constraint plus renaming `MeetingFilter` to `MeetingFilterValue` to make it clear it is intentionally wide.

### MOD-4: `sampleHourly` in `WeatherStrip.tsx` recomputes on every render without `useMemo`
**File:** `packages/web/src/components/strips/WeatherStrip.tsx:35–53`
**Issue:** `sampleHourly(hourly, nowStr)` is called inline during render. `nowStr` is derived from `new Date()` on every render, so the result cannot be memoized with the array as the only dependency. However, the function iterates the full hourly array (up to 168 entries for 7 days) on every render, including re-renders triggered by i18n language changes or unrelated parent updates. A `useMemo` with `[hourly, data?.current?.weatherCode]` as dependencies would avoid the computation when the data has not changed.
**Fix:** Wrap the `sampleHourly` call in `useMemo`. The `nowStr` dependency should be derived from a state variable (or simply recomputed inside the memo since the function only filters by time comparison and the result is stable between cron updates).

### MOD-5: `formatDelta` in `FeuerwehrStrip.tsx` is duplicated from similar helpers in other strips
**File:** `packages/web/src/components/strips/FeuerwehrStrip.tsx:15–27`
**Issue:** `formatDelta` computes a percentage delta with color coding. A nearly identical pattern appears in `LaborMarketStrip.tsx`. Both could share a utility from `packages/web/src/lib/`. The duplication is minor (two files) but creates the risk of color thresholds diverging. The `formatTime` helper (lines 9–13) is also a small formatting utility that would benefit from living in a shared `lib/format-time.ts`.
**Fix:** Extract `formatDelta` and `formatTime` to `packages/web/src/lib/format-stats.ts` with tests. Import from both strips.

### MOD-6: `BriefingStrip.tsx` splits paragraphs on double-newlines but does not handle `\r\n` line endings
**File:** `packages/web/src/components/strips/BriefingStrip.tsx:11`
**Issue:** `text.split(/\n\s*\n/)` splits on LF-only double newlines. GPT responses may return `\r\n\r\n` (CRLF) paragraph separators on Windows-style outputs, causing the briefing to render as a single unsplit paragraph. The regex should normalize carriage returns.
**Fix:** Change to `text.replace(/\r\n/g, '\n').split(/\n\s*\n/)` or use `/\r?\n\s*\r?\n/` as the split pattern.

### MOD-7: `useFreshness` always attaches a `visibilitychange` listener even when `fetchedAt` is null
**File:** `packages/web/src/hooks/useFreshness.ts:18–28`
**Issue:** The `useEffect` that sets up the interval and `visibilitychange` listener runs unconditionally, regardless of whether `fetchedAt` is null. When `fetchedAt` is null, the hook returns early (line 30) without using `now`. This means every mounted tile that has no data still attaches a `visibilitychange` listener and a 60s interval — in the worst case, dozens of tiles attach listeners on the initial page load before bootstrap data arrives.
**Fix:** Either add `if (!fetchedAt) return;` before registering the interval/listener in the effect, or check `fetchedAt` as an effect dependency so the effect is conditional.

---

## Nice-to-Have

### NTH-1: `weather-tiles.ts` tile coordinate validation allows zoom levels 0–7 only — missing rationale comment
**File:** `packages/server/src/routes/weather-tiles.ts:52`
**Issue:** `z < 0 || z > 7` restricts zoom without a comment explaining that RainViewer's free tile endpoint only supports up to zoom 7. Future maintainers may think the limit is arbitrary.
**Fix:** Add an inline comment: `// RainViewer free tier: max zoom 7`.

### NTH-2: `DashboardGrid` uses `Children.map` + `cloneElement` which is a React legacy pattern
**File:** `packages/web/src/components/layout/DashboardGrid.tsx:6–11`
**Issue:** The `Children.map` + `cloneElement` pattern for injecting `revealIndex` is React's legacy approach. React 19 (the project's current version) recommends passing render props or context instead. The `Children.map` approach also breaks with Fragment children. While it works today, it will generate deprecation warnings in a future React version.
**Fix:** Wrap the grid in a context that provides the tile index, or pass `revealIndex` explicitly from the shell that renders the grid. This is a low-priority refactor since `revealIndex` only affects CSS animation delay.

### NTH-3: `ingest-political.ts` hardcodes Bezirksbürgermeister data with a "last verified" comment but no automated staleness check
**File:** `packages/server/src/cron/ingest-political.ts:22`
**Issue:** The `BEZIRKSBUERGERMEISTER` constant contains 12 hardcoded district mayor entries with `// Last verified: 2026-03-02`. District governments change after elections or resignations, and the hardcoded data will silently go stale. There is no mechanism to detect this.
**Fix:** Add a log.warn at startup if the hardcoded data is older than 180 days (derive from a `LAST_VERIFIED` constant), prompting a manual review. Alternatively, document in `.context/new-data-sources.md` that this constant requires periodic manual updates.

### NTH-4: `CrisisStrip.tsx` Berlin-specific data with no city guard
**File:** `packages/web/src/components/strips/CrisisStrip.tsx:34–56`
**Issue:** `SERVICES` and `KRISENDIENST_REGIONS` contain Berlin-specific crisis hotline numbers (030 area code, Berliner Krisendienst) but the strip has no guard to hide itself for Hamburg or other cities. It will show Berlin phone numbers to Hamburg users. The `DashboardGrid` in the web app controls which strips appear per city, but if a new city is added, a developer must remember to exclude this strip.
**Fix:** Either add a `useEffect` guard that checks `cityId === 'berlin'` or document in `CrisisStrip.tsx` with a comment that the strip should only be mounted for Berlin. Add a test that verifies the strip renders `null` or a placeholder for non-Berlin cities.

### NTH-5: `Popover.tsx` focus trap is incomplete for keyboard navigation
**File:** `packages/web/src/components/layout/Popover.tsx`
**Issue:** The TopBar weather and AQI popovers open on hover and are accessible via keyboard through the trigger button's `aria-label`, but the popover content does not trap focus or manage the `aria-expanded` attribute on the trigger. A keyboard user who opens the popover with Enter cannot navigate into the popover's content using Tab, and pressing Escape does not close it.
**Fix:** Add `onKeyDown` to the trigger button to call `onOpenChange(false)` on Escape, and use `aria-expanded={open}` on the trigger. For full accessibility, add a focus trap inside the popover when `open` is true.

### NTH-6: `reads.ts` `loadAirQualityGrid` inline Zod schema should be extracted to shared schemas
**File:** `packages/server/src/db/reads.ts:202–209`
**Issue:** The `loadAirQualityGrid` function defines an inline Zod schema (`z.array(z.object({ lat: z.number(), ... }))`) instead of using `AirQualityGridPointSchema` from `@city-monitor/shared/schemas.js`. All other `loadSnapshot` calls in this file use imported schemas from shared. This inline schema may drift from the canonical type definition.
**Fix:** Add `AirQualityGridPointSchema` to `packages/shared/src/schemas.ts` and replace the inline schema in `loadAirQualityGrid` with `z.array(AirQualityGridPointSchema)`.

### NTH-7: `openai.ts` `stripBareCityLabel` is untested
**File:** `packages/server/src/lib/openai.ts:39–46`
**Issue:** The `stripBareCityLabel` function that prevents bare city-name geocoding is a pure utility with three clear branches (null input, exact city match, city prefix match), but the existing `openai.test.ts` only tests `isConfigured`, `summarizeHeadlines`, `filterAndGeolocateNews`, and `geolocateReports` at the top level. The helper is not exercised in isolation.
**Fix:** Export `stripBareCityLabel` and add 4–5 unit tests covering: null, undefined, exact city name, city name as prefix, and a legitimate sub-district label.

---

## Summary

| Priority | Count | Items |
|---|---|---|
| Critical | 0 | — |
| Important | 4 | IMP-1 through IMP-4 |
| Moderate | 7 | MOD-1 through MOD-7 |
| Nice-to-have | 7 | NTH-1 through NTH-7 |

**Top actionable items:**
1. **IMP-1** — Add `ingest-political.test.ts` for `normalizeParty`, `normalizeConstituencyName`, `deduplicateMandates`, `filterBundestagForCity`, `constituencyToBezirk` (pure helpers with non-trivial logic, currently zero coverage).
2. **IMP-3** — Replace hardcoded `'berlin'` string literals in the `warm-cache.ts` Berlin-only block with `cityId` variable to prevent silent data-routing bugs if a second Berlin-profile city is ever added.
3. **MOD-2** — Fix the confusing third condition in `isDwdSource` which uses double-negation optional-chaining that evaluates unexpectedly and remove it to simplify the DWD detection logic.
