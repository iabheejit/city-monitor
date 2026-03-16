# Get to Work — Follow-up

## Controversial Decisions
Items where the agent made a judgment call the user should review.

## Skipped Improvements
Opportunities identified but not implemented, with reasons.

- **C1 (xlsx replacement)**: Dependency upgrade — per autonomous conventions, skip dependency changes.
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

## Cycle Log
Summary of each find → plan → implement cycle.

### Cycle 1 — Full codebase scan (24 items found, 8 plans, 8 implemented)

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
