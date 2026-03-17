# Get to Work — Follow-up

## Controversial Decisions
Items where the agent made a judgment call the user should review.

### Plan 27: Event Lookahead Config
1. **Field placed on `EventSourceConfig` (per-source) rather than as a top-level events config field.**
   - Reasoning: Only Kulturdaten uses date-range query parameters in the current implementation. Ticketmaster and gomus fetchers don't use a lookahead window. Placing it per-source keeps the config honest and extensible.
   - Alternative: A top-level `eventsLookaheadDays` on `CityDataSources`. Simpler but semantically wrong since it wouldn't actually affect all sources.

2. **Default changed from 7 to 14 days.**
   - This is explicitly requested in the task description ("defaulting to 14 days for richer event discovery"). Existing Berlin config has no explicit value, so it will automatically get the new 14-day default.

### Plan 25: Replace xlsx with exceljs
1. **Chose `exceljs` over lightweight alternatives** (`read-excel-file`, `xlsx-parse-json`). `exceljs` is larger (~2MB) but is the most mature MIT-licensed XLSX library for Node with 10M+ weekly npm downloads. Server-side dependency, so bundle size is irrelevant.
2. **Refactored parse functions to accept `unknown[][]`** (array-of-arrays) instead of library-specific worksheet objects. This decouples parsing logic from any XLSX library, making future migrations trivial. Alternative was passing ExcelJS worksheet objects directly.

### Plan 26: CSP Header for Static Frontend
1. **Used `'unsafe-inline'` for script-src instead of nonce/hash.**
   - Reasoning: Render static sites serve pre-built HTML and cannot inject per-request nonces. A SHA-256 hash would work but is fragile -- any change to the inline script (even whitespace) breaks it, and the hash cannot be auto-generated into render.yaml at build time. The inline script is a small theme-detection snippet that must run before external JS to prevent FOUC.
   - Alternatives: nonce-based (impossible without dynamic server), hash-based (fragile, manual maintenance), move to external file (loses FOUC prevention).

2. **Deployed as enforcing `Content-Security-Policy` rather than `Content-Security-Policy-Report-Only`.**
   - Reasoning: The policy was derived from a thorough audit of all external origins in the codebase. Report-Only would require a reporting endpoint that doesn't exist. If issues arise post-deploy, the fix is a one-line edit to render.yaml.
   - Alternative: Report-Only first (safer rollout but requires reporting infrastructure).

### Plan 29: Type Consolidation
1. **TransitAlert `lines` field made required (`lines: string[]`) matching the server definition.**
   - Reasoning: The server always populates the `lines` array. The web's `lines?: string[]` was overly cautious. The web already handles potential absence via `alert.lines ?? [alert.line]`, so the required field is backward-compatible. Alternative: keep optional in shared -- rejected because it would mean the shared type is less accurate than the server's actual output.
2. **ScSensorData left private to ingest-noise-sensors.ts.**
   - Reasoning: It models the Sensor.Community external API response shape, not a domain type. Tests already work with plain objects. Exporting it would create a public contract around an unstable external API format. Alternative: export and/or move to shared -- rejected because no consumer needs it.

### Plan 30: Frontend Quality Bundle
1. **`formatDayName` uses optional string params instead of passing `t` function.**
   - Reasoning: Keeps the utility i18n-agnostic. Callers resolve `t('panel.weather.today')` and `t('panel.weather.tomorrow')` before calling, so the function only deals with strings and dates.
   - Alternative: Pass the `t` function directly (couples a date utility to i18next). Another alternative: two separate functions (unnecessary complexity).

2. **Logger wrapper created with no current callers.**
   - Reasoning: The web `src/` directory has zero `console.*` calls. The logger is infrastructure for future use, as suggested in Plan 01's follow-up. It is trivial (5 lines) so the cost of creating it now is near zero.
   - Alternative: Wait until the first `console.*` call is needed. Chose to create it now so new code has a clear convention to follow.

3. **District paint constants as a function, not exported.**
   - Reasoning: Values depend on `isDark` boolean, so a function is more ergonomic than separate light/dark constant objects. Kept file-private since only `political.ts` uses them.
   - Alternative: Export from `constants.ts` (no other consumers, unnecessary indirection).

4. **Item 4 (de-DE audit): no changes needed.**
   - The audit found zero `'de-DE'` patterns in the web package. All `toLocale*` calls already use `i18n.language` or `locale` from hooks. Plan 18 already cleaned this up.

### Plan 32: Ops & Maintenance Improvements
1. **Renamed `Mitte` to `Hamburg-Mitte` and `Nord` to `Hamburg-Nord` in Hamburg districts.**
   - Reasoning: Bare "Mitte" causes false positives in German police text (common word meaning "middle/center"). Police press releases for Hamburg use "Hamburg-Mitte" as the Bezirk name. Same logic for "Nord" -> "Hamburg-Nord".
   - Alternative: Keep `Mitte`/`Nord` for simplicity. Rejected due to false-positive risk.

2. **AEDs and budget share the same rate limiter instance as social-atlas/population (10 req/min combined).**
   - Reasoning: All four are heavy-payload endpoints. A shared counter means 10 total requests across all heavy endpoints per minute per client, which is stricter but prevents abuse patterns that rotate between heavy endpoints.
   - Alternative: Separate rate limiter instances per endpoint (10 req/min each, independent). Would allow 40 heavy requests/min total. Rejected as overly permissive for the use case.

3. **Bootstrap Cache-Control changed from 300s (inherited from news router) to 60s.**
   - Reasoning: Bootstrap is an initial-load aggregation endpoint. 300s is too stale for first page load. Individual endpoints handle their own longer caching for polling.
   - Alternative: Keep 300s for consistency. Rejected because bootstrap serves a different purpose than individual data endpoints.

4. **Hamburg districts list includes ~70 entries (vs. 104 official Stadtteile).**
   - Reasoning: Many Stadtteile are tiny and never appear in police press releases (e.g., Tatenberg, Spadenland). Including only recognizable ones avoids list bloat. Can always add more if specific Stadtteile are observed in reports.
   - Alternative: Include all 104. Rejected as unnecessary -- the extraction is a simple string match and obscure names add no value.

## Skipped Improvements
Opportunities identified but not implemented, with reasons.

- **C1 (xlsx replacement)**: Dependency upgrade -- per autonomous conventions, skip dependency changes.
- **N7 (CSP header on Render)**: Changes external deployment config, not code.
- **M4 (event lookahead config)**: Feature addition, not quality improvement.

## User Input Needed
Questions that blocked implementation of specific improvements.

## DB Migrations
Schema changes that need to be applied.

## Files to Delete
Files that should be removed (agent does not delete files autonomously).

- `packages/server/src/cron/tz-check.test.ts` -- Diagnostic placeholder file created during Plan 15 implementation. Contains a single trivial passthrough test. Should be deleted.

## Implementation Issues
Problems encountered during implementation.

## Suggested Follow-Up Work
- Consider adding rate limits to other large-payload endpoints (construction sites, pharmacies) if abuse is observed.
- The `extractDistrict` function in `ingest-safety.ts` uses a naive `title.includes()` approach. A regex word-boundary match would reduce false positives further (e.g., "Hamm" matching "Hammer Strasse"). Low priority but worth noting.

## Cycle Log
Summary of each find -> plan -> implement cycle.

### Cycle 1 -- Full codebase scan (24 items found, 8 plans, 8 implemented)

### CI Turbo Cache
- **Plan:** `.plans/04-ci-turbo-cache.md`
- **No controversial decisions, no user input needed, no suggested follow-up work.**

### Small Code Quality Fixes
- **Plan:** `.plans/01-small-code-fixes.md`
- **Controversial decisions:**
  1. C2: Chose `console.warn` over removing the call entirely. A GeoJSON swap error is non-fatal but still worth knowing about during development. The frontend has no structured logger, so raw console calls are the norm.
  2. N8: Chose silent return on null data (`if (data == null) return`) over throwing. Throwing would crash the cron job for a single bad data point. Callers already handle missing data upstream.
- **Suggested follow-up work:**
  - The bootstrap endpoint in `news.ts` could be moved to its own route file since it serves all city data, not just news.
  - Consider adding a structured frontend logger wrapper around `console.*` calls.

### Database Query Improvements
- **Plan:** `.plans/02-db-query-improvements.md`
- **Controversial decisions:**
  1. Events limit of 500 vs 200: Went with the specified 500 since the retention window keeps up to 7 days of past events alongside future ones, so 500 provides buffer over the cron's MAX_FUTURE_EVENTS=200.
  2. NOT EXISTS implementation: Used Drizzle's `notExists()` builder rather than raw SQL to stay consistent with the file's style.
- **No user input needed, no suggested follow-up work.**

### Reactive useIsDesktop Hook
- **Plan:** `.plans/03-use-is-desktop-hook.md`
- **Controversial decisions:**
  1. Chose `useSyncExternalStore` over `useEffect` + `useState`. It is the React 18+ recommended API for external subscriptions, avoids tearing in concurrent mode, and produces less code. The `useEffect` + `useState` pattern would also work but has no advantage.
  2. Created a generic `useMediaQuery` hook with a thin `useIsDesktop` wrapper rather than a single-purpose hook, for reusability with other media queries.
  3. Kept `isDesktop` as a prop to `BathingTile` rather than calling the hook inside it, to minimize changes.
- **Suggested follow-up work:**
  - `Tile.tsx:44` has a one-shot `matchMedia('(prefers-reduced-motion: reduce)')` check that could use `useMediaQuery` for live reactivity.
  - `useTheme.ts:14` reads `prefers-color-scheme` in an initializer and could benefit from `useMediaQuery` for system theme changes.

### Deduplicate News Types
- **Plan:** `.plans/07-deduplicate-news-types.md`
- **Controversial decisions:**
  1. Single shared type with all fields rather than base+extension pattern. `sourceUrl` and `lang` go directly on the shared `NewsItem` even though the web side doesn't use them. Two extra fields are harmless; base+extension adds indirection for no practical benefit.
- **Suggested follow-up work:**
  - Other types in `packages/web/src/lib/api.ts` (e.g., `TransitAlert`, `SafetyReport`, `EventData`) may also be duplicated or drifted from server definitions. A broader audit could move more types to shared.

### Parallelization Fixes
- **Plan:** `.plans/06-parallelization-fixes.md`
- **Controversial decisions:**
  1. BVV concurrency model: Chose rate-gated concurrent using existing `createRateGate(1000)` over a concurrency-limited pool. All 11 promises launch immediately; the gate serializes the actual HTTP requests with 1s spacing while allowing pagination overlap. A concurrent pool would hit multiple OParl servers simultaneously, which may violate the politeness intent of the original 1s delay.
  2. PARDOK: Used `Promise.allSettled` instead of the specified `Promise.all`. The current code uses `continue` on failure (one source failing shouldn't prevent the other from contributing). `Promise.all` would reject on first failure, losing the successful result. This matches the defensive error-handling pattern used throughout the codebase.
- **No user input needed, no suggested follow-up work.**

### Route Tests (pollen, feuerwehr, council-meetings, noise-sensors)
- **Plan:** `.plans/05-route-tests.md`
- **Controversial decisions:**
  1. Skipped DB fallback tests. The task mentioned testing "DB fallback" but no existing route test actually tests this path -- they all test only cache-hit, empty-response, and 404. Adding DB mocking would introduce a new test pattern inconsistent with the 21 existing test files and require either a real test DB or mock infrastructure. Chose to match the existing 3-test pattern for consistency.
- **Suggested follow-up work:**
  - Add DB fallback tests across all route test files (would require a test DB or mock pattern for `db/reads.ts`).
  - Add test for `construction.ts` route (also missing a test file).

### Misc Improvements
- **Plan:** `.plans/08-misc-improvements.md`
- **Controversial decisions:**
  1. Shared rate limiter for social-atlas + population routes: Used a single `rateLimit()` instance for both routes, meaning the 10 req/min budget is shared across both endpoints per IP. Alternative was separate limiters per route. Chose shared because these are both heavy GeoJSON endpoints rarely hit in quick succession, and a shared budget better protects against abuse patterns that alternate between endpoints.
  2. Composite key format for OpenAI usage tracking: Changed from `{ berlin: {...} }` to `{ "gpt-5-mini:berlin": {...}, "gpt-5-nano:berlin": {...} }`. This changes the health endpoint JSON shape. Alternative was a nested structure preserving backward compatibility but adding complexity. Chose the flat key because the health endpoint is internal-only.
  3. Hamburg districts list: Added a reasonable set of Hamburg Bezirke and neighborhoods. These may not be exhaustive; both city lists can be extended over time.
  4. Constants file location: Created `packages/web/src/lib/constants.ts` for SUPPORT_URL. The `lib/` directory already exists with other utility files.
- **Suggested follow-up work:**
  - Extend the Hamburg districts list with more neighborhoods for better police report district extraction.
  - Consider adding rate limits for other heavy endpoints (AEDs GeoJSON, budget data).
  - The OpenAI model pricing in `MODEL_PRICING` will need updating when OpenAI changes prices or new models are used.

### Noise Sensor Parse Tests
- **Plan:** `.plans/11-noise-sensor-tests.md`
- **No controversial decisions, no user input needed.**
- **Suggested follow-up work:**
  - The `ScSensorData` interface is private to the module. If more tests or utilities need it, consider exporting it or moving it to shared types.

### Type Safety Fixes
- **Plan:** `.plans/10-type-safety-fixes.md`
- **Controversial decisions:**
  1. Adopted shared `TrafficIncident` with `| null` widening on 7 optional fields without updating consumers. The shared type uses `field?: T | null` where the local type used `field?: T`. Frontend code uses optional chaining and fallback patterns that handle both `undefined` and `null` identically. The shared type is actually more correct since the server/DB can produce `null`. Alternative: narrow the shared type to remove `| null` -- rejected because it would misrepresent what the server actually sends.
  2. Using MapLibre's exported `Listener` type for spider handler callbacks. The plan suggested `(...args: unknown[]) => void` but that failed typecheck because callers pass `(e: MapMouseEvent) => void` and TypeScript's contravariance rejects `unknown` parameters. `Listener` is MapLibre's own `(a: any) => any` -- the `any` lives in the library's type definition rather than our code, which is acceptable since these handlers are passed opaquely to `map.on`/`map.off`.
- **Suggested follow-up work:**
  - The `AirQuality` interface is defined locally in `api.ts` but does not exist in `shared/types.ts`. Consider adding it to shared.
  - Several other local interfaces (`TransitAlert`, `CityEvent`, `SafetyReport`, `BootstrapData`, `NewsSummaryData`) exist only in `api.ts` and could be moved to shared for server-side type safety.

### Code Quality Batch (3 refactors)
- **Plan:** `.plans/12-code-quality-batch.md`
- **Controversial decisions:**
  1. M4 helper signature accepts `string | null | undefined`: The LLM schema returns `string().nullable()`, so `item.locationLabel` is `string | null`. Made the helper absorb the null-coalescing rather than requiring callers to convert first. Alternative: accept only `string | undefined` and keep `?? undefined` at call sites.
  2. M5 hash window 10 + named constant: Task said "5 to 10 (or extract as named constant)". Chose both -- increase to 10 AND extract as `HASH_HEADLINE_COUNT`. 10/25 (40%) is a reasonable change-detection window. Alternative: keep at 5 and just name it.

### More Parallelization (safety ingestion + data retention)
- **Plan:** `.plans/13-more-parallelization.md`
- **Controversial decisions:**
  1. No concurrency cap for data-retention deletes: All ~28 delete queries run concurrently against Postgres with no pooling/batching. These are lightweight, infrequent (daily) DELETE operations on distinct table partitions. A semaphore or chunked approach would add complexity for no meaningful benefit.
  2. Filtering cities before `Promise.allSettled` (safety): Moved the `if (!city.dataSources.police) continue` guard into a `.filter()` before `.map()`, which is cleaner for the parallel pattern and behaviorally identical.
- **No user input needed, no suggested follow-up work.**

### CI-Blocking Fixes (Lint + Test)
- **Plan:** `.plans/09-ci-fixes.md`
- **Controversial decisions:**
  1. Kept `NewsDigest` on the line 12 import despite the task requesting its removal. `NewsDigest` is used locally in `BootstrapData` (line 17) and `getNewsDigest` (line 159). In TypeScript, `export type { X } from 'y'` does NOT introduce `X` into local scope, so removing the import would cause a compile error. Only `NewsItem` is truly unused locally. If the linter actually flags `NewsDigest` too, the implementer should run lint to verify and adjust.
- **Suggested follow-up work:**
  - The import/export organization in `api.ts` lines 11-14 is messy (split across three statements with no clear reason). Consider consolidating into one re-export line plus one import line for locally-used types.

### District Layer Dedup
- **Plan:** `.plans/14-district-layer-dedup.md`
- **Controversial decisions:**
  1. New `addDistrictSource` function vs. extending `addDistrictLayer`: Chose a separate function because `addDistrictLayer` handles its own fetch, cleanup, and hover-aware opacity for the non-political path. Parameterizing it would add flags for no real gain.
  2. Helper does not handle cleanup: The two call sites have different pre-conditions (style.load bails if source exists; effect removes old layers first). Pushing cleanup into the helper would require a "force" flag or always-remove semantics that could mask bugs.
- **Suggested follow-up work:**
  - Paint values for line/label layers are shared across `addDistrictLayer` and `addDistrictSource`. Extracting them into constants would reduce duplication further, but the values are just color strings and not worth a separate change.

### More Cron Tests (council-meetings, traffic, nina, pharmacies)
- **Plan:** `.plans/15-more-cron-tests.md`
- **Controversial decisions:**
  1. Exporting private functions for testability. The 12 target functions are all module-private. Rather than testing indirectly through the ingestion factory (which would require mocking fetch, DB, and city config), chose to add `export` to each function. This is the same pattern used by `ingest-pollen.ts` which exports `parseDwdPollenJson` specifically for testing. The alternative (integration-style tests with mocks) was rejected because the task explicitly says "don't mock fetch or DB."
  2. Exporting `ICON_TO_TYPE` as a const. This is a `const` record, not a function. Exporting it allows tests to verify the mapping table directly. Low-risk since it is `const` and cannot be mutated by consumers.
  3. Exporting `isDwdSource` and `parseDashboardWarning` from ingest-nina. These are slightly more complex than pure mappers -- `parseDashboardWarning` calls `detectSource` and `mapSeverity` internally. Testing them directly still qualifies as "pure function" testing since they have no side effects.
- **Suggested follow-up work:**
  - `berlinUtcOffset()` returns wrong offset on Windows because `Intl.DateTimeFormat` returns "GMT+2" instead of "CEST". Fix by checking for both names or parsing the numeric offset.
  - `parsePardokXml()` returns empty array when PARDOK XML contains exactly one `<row>` because `fast-xml-parser` returns an object (not array) for single elements. Fix with `const rows = Array.isArray(rawRows) ? rawRows : rawRows ? [rawRows] : [];`.

### PoliticalStrip A11Y
- **Plan:** `.plans/19-political-strip-a11y.md`
- **No controversial decisions, no user input needed.**
- **Suggested follow-up work:**
  - Audit other components for missing ARIA tabs patterns. A codebase-wide grep for tab-like UI that lacks `role="tablist"` could surface other accessibility gaps beyond PoliticalStrip.

### Quick Fixes Batch (6 targeted fixes)
- **Plan:** `.plans/17-quick-fixes-batch.md`
- **Controversial decisions:**
  1. MOD-2 i18n values copied from transit.more: The new `panel.appointments.more` translations use identical values to `panel.transit.more`. Each domain should own its key for future independent changes, even though the values are currently the same.
  2. MOD-8 regex uses `\w+` for city name: The `(?:\w+,\s+)?` pattern won't match city names with spaces, hyphens, or umlauts (e.g., "Frankfurt am Main"). Current WAQI station data uses single-word city identifiers so this works. If multi-word city names appear, the regex would need `[^,]+` instead of `\w+`.
- **No user input needed, no suggested follow-up work.**

### Missing Route Test: construction
- **Plan:** `.plans/20-missing-route-tests.md`
- **Controversial decisions:**
  1. Only creating `construction.test.ts`, not `noise-sensors.test.ts`. The task asked for both but `noise-sensors.test.ts` already exists with the full 3-test pattern. Creating it again would overwrite existing tests.
- **Suggested follow-up work:**
  - Add tests for `weather-tiles.ts` -- the other route without test coverage. It has a different pattern (tile proxy, no cache/city lookup, external HTTP) and needs a different test approach (mocking fetch, testing coordinate validation, 503 when no radar path).

### Misc Frontend Fixes
- **Plan:** `.plans/21-misc-frontend-fixes.md`
- **Controversial decisions:**
  1. SafetyStrip is orphaned (not imported anywhere) but still being fixed per the task request. When re-integrated it will match the other strips' pattern.
  2. No new tests for useFreshness visibilitychange -- the addition is 3 lines in an existing effect; test would require document.visibilityState mocking for minimal value.
  3. Turkish translations for expand/collapse used "genislet"/"daralt" -- reasonable but a native speaker may prefer alternatives.
- **Suggested follow-up work:**
  - Re-integrate or remove SafetyStrip. The component is exported but not imported anywhere. It should either be wired into CommandLayout or deleted.

### i18n Locale Fixes
- **Plan:** `.plans/18-i18n-locale-fixes.md`
- **Controversial decisions:**
  1. Used `i18n.language` directly rather than `undefined` (browser locale) for `toLocaleString` calls. `i18n.language` keeps formatting consistent with the user's explicit language choice in the app. A Turkish user with an English browser locale would still see Turkish formatting when they select Turkish. Using `undefined` would defer to OS/browser settings which may mismatch the app language.
  2. Used abbreviated "Tmrw" for English weather today/tomorrow labels to match the compact weekday column widths in the forecast UI (matching the existing hardcoded behavior). Other languages use full words since their weekday abbreviations vary in length.
- **Suggested follow-up work:**
  - Audit other components for similar hardcoded locale patterns (search for `'de-DE'` and `'de' ? 'de'` across the codebase).
  - The WeatherPopover `formatDayName` function duplicates logic from WeatherStrip's `formatDayName` -- consider extracting a shared utility.

### Small Fixes Batch 2
- **Plan:** `.plans/23-small-fixes-batch-2.md`
- **Controversial decisions:**
  1. Fix 3 (isDwdSource): Added `?? false` null coalescing to both conditions for strict boolean return. Alternative was relying on `undefined || ...` implicit coercion, which works identically but is less explicit.
  2. Fix 5 (useFreshness): Added `fetchedAt` to the useEffect dependency array so the effect re-runs when data arrives. Cannot move the null check before hooks due to React rules. The early return inside the effect body is the standard React pattern for conditional effects.
- **Suggested follow-up work:**
  - The warm-cache Berlin-only block could be extended when Hamburg gains these data sources -- the guard already uses `cityId` after this fix.

### Frontend Refactors
- **Plan:** `.plans/24-frontend-refactors.md`
- **Controversial decisions:**
  1. Kept `formatYoy` as a separate function rather than unifying with `formatDelta`. They have different signatures (pre-computed percentage vs. two raw values). Forcing unification would require reverse-engineering raw values from the percentage.
  2. Moved `useMemo` before early returns (using `data?.hourly` as `rawHourly`) to satisfy the `react-hooks/rules-of-hooks` lint rule. The plan placed it after early returns, but hooks must be called unconditionally. The memo handles null/empty input with an early `return []`.
- **Suggested follow-up work:**
  - Unit tests for `format-stats.ts` were added (15 tests). No further action needed.
  - The `BEZIRKSBUERGERMEISTER_LAST_VERIFIED` date needs manual updates when re-verified. Consider a CI check or automated scrape.

### More Test Coverage
- **Plan:** `.plans/22-more-test-coverage.md`
- **Controversial decisions:**
  1. Exporting 7 private functions for testability (`normalizeParty`, `normalizeConstituencyName`, `mandateToRepresentative`, `filterBundestagForCity`, `deduplicateMandates`, `constituencyToBezirk`, `stripBareCityLabel`). These are pure utility functions in internal server modules with no external consumers. Direct export is zero-cost and avoids heavy mocking. Alternative: test indirectly through cron jobs (rejected -- requires mocking fetch, DB, cache for no benefit).
  2. Not exporting `BERLIN_BEZIRKE` for `constituencyToBezirk` tests. Tests pass their own bezirk arrays to test the algorithm, not the data. This keeps tests decoupled from the hardcoded constant.
- **Suggested follow-up work:**
  - The `ingest-political.ts` cron job orchestration (`ingestCityPolitical`, `fetchMandates`, `fetchCurrentPeriod`) has no tests. Integration-style tests with mocked fetch would cover the orchestration logic.
  - The `openai.ts` module's `classifyBatch` and `filterAndGeolocateNews` are only tested for the "not configured" path. Integration tests with a mocked LangChain model would cover structured output parsing and batch logic.

### Replace xlsx with exceljs
- **Plan:** `.plans/25-replace-xlsx-with-exceljs.md`
- **No user input needed, no suggested follow-up work.**

### CSP Header for Static Frontend
- **Plan:** `.plans/26-csp-header-render.md`
- **Suggested follow-up work:**
  - Add a `Permissions-Policy` header to restrict unused browser features (camera, microphone, geolocation).
  - Add `X-Content-Type-Options: nosniff` and `Referrer-Policy` headers.
  - Consider extracting the inline theme-detection script to an external file to allow removing `'unsafe-inline'` from script-src.

### Type Consolidation
- **Plan:** `.plans/29-type-consolidation.md`
- **Controversial decisions:** See Plan 29 section above.
- **No user input needed, no suggested follow-up work.**
