# Improvement Opportunities — 2026-03-16

## Scope

Full codebase scan: `packages/server`, `packages/web`, `shared`. Excluded: `.git`, `node_modules`, `shared/dist`, `.plans/completed`, build artifacts.

## Automated Check Results

- **Linter/Typecheck**: CI runs both; no findings from static scan (no output available without running).
- **Tests**: Strong coverage overall. See Test Coverage section below.
- **Dependencies**: `xlsx` (SheetJS) at `^0.18.5` — abandoned fork known for security issues. All other deps are mainstream and up-to-date.

---

## Findings

### Critical

**C1 — `xlsx` (SheetJS) dependency is an abandoned, security-problematic package**
- File: `packages/server/package.json`
- `xlsx@^0.18.5` is the original SheetJS package, which is no longer maintained on npm. The maintained fork is `xlsx@https://cdn.sheetjs.com/xlsx-...` (paid) or the community alternative `exceljs`. The npm package has had high-severity CVEs unfixed for years.
- Used only in `packages/server/src/cron/ingest-population.ts` to parse the Amt für Statistik XLSX file.
- Recommendation: Replace with `exceljs` (MIT, actively maintained) or `node-xlsx` (simpler wrapper). The population ingestion only reads a single sheet, so migration is small.

**C2 — `console.error` bypasses the logger in `CityMap.tsx`**
- File: `packages/web/src/components/map/CityMap.tsx:754`
- One raw `console.error('[political] GeoJSON swap error:', e)` call is present in the political layer swap effect. The project convention (from `.context/server.md`) states no raw `console.*` calls; on the frontend this isn't as critical but the error is silently swallowed and never reaches any monitoring surface. If this code path fails in production it will be invisible.
- Recommendation: Convert to a proper pattern — either log via a frontend logger utility or at minimum `console.error` through a wrapper so it can be intercepted by error tracking (e.g., Sentry).

---

### Important

**I1 — Missing route tests for 4 newer routes**
- Files: `packages/server/src/routes/pollen.ts`, `feuerwehr.ts`, `council-meetings.ts`, `noise-sensors.ts`
- 21 of 25 route files have corresponding `.test.ts` files. The four newest routes (pollen, feuerwehr, council-meetings, noise-sensors) have no route-level tests. These routes all follow the same cache-first / DB-fallback pattern tested elsewhere, but they remain unverified for edge cases (city-not-found 404, DB fallback, empty responses).
- Recommendation: Add route tests following the existing pattern in `routes/weather.test.ts` or `routes/pollen.ts`-adjacent files.

**I2 — Missing ingest tests for `ingest-council-meetings.ts` and `ingest-noise-sensors.ts`**
- Files: `packages/server/src/cron/ingest-council-meetings.ts`, `ingest-noise-sensors.ts`
- 18 of 20 cron ingestion files have tests. Council meetings and noise sensors — two of the more complex ingestion paths — have none. Council meetings has especially complex logic: OParl pagination, PARDOK XML parsing, DST-aware timezone handling, Berlin-only 11-district parallel fetching with 1s delays.
- Recommendation: Add tests for `parsePardokXml()` and `parseNoiseSensors()` at minimum (both are exported helper functions amenable to pure unit tests). OParl pagination can be tested with mocked fetch sequences.

**I3 — `isDesktop` computed with `window.matchMedia` at render time — SSR-unsafe and causes layout flash**
- File: `packages/web/src/components/layout/CommandLayout.tsx:61`
- `const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;` is evaluated once during component creation and never re-evaluated on resize. This means `defaultExpanded` for all dashboard tiles is wrong if the user resizes the browser, and on any server-rendering context (even prerender) it will always evaluate to `false`.
- Recommendation: Replace with a proper `useMediaQuery` hook that subscribes to `matchMedia.addEventListener('change', ...)` so it stays in sync, or use a shared `useIsDesktop` hook with `useState` + `useEffect` pattern.

**I4 — Council meetings BVV districts fetched sequentially with 1-second delay — 11+ second startup cost**
- File: `packages/server/src/cron/ingest-council-meetings.ts:244`
- Berlin has 11 BVV districts, each fetched sequentially with `await delay(DELAY_BETWEEN_DISTRICTS_MS)` (1000ms) between them. On startup this means 11+ seconds of serial API calls before any council data is available. The 1s delay is a politeness delay for the OParl servers, which is correct, but it doesn't require serialization — a rate-limited concurrent pool with a minimum inter-request gap would respect the intent while being faster.
- Recommendation: Use a rate-gated concurrent approach (similar to `ingest-feeds.ts`'s `CONCURRENCY=8` pool) or at least use `Promise.all` with per-request 1s delays using `AbortController` + staggered starts. The existing `createRateGate` utility in `lib/rate-gate.ts` could be reused here.

**I5 — `loadSafetyReports` reads ALL safety reports for a city without a date filter**
- File: `packages/server/src/db/reads.ts:303`
- `loadSafetyReports` does `SELECT * FROM safety_reports WHERE city_id = $1 ORDER BY published_at DESC` with no date limit or row limit. After 7 days of 10-minute police RSS polling (~1008 cron runs × multiple reports each), this table grows large. The retention cron only prunes at 3am daily, so during the day the table keeps growing. The DB read at startup could become slow.
- Recommendation: Add `.limit(200)` (consistent with `loadNewsItems`) and/or a `.where(gte(safetyReports.publishedAt, new Date(Date.now() - 7 * DAY_MS)))` date filter to mirror the retention window.

**I6 — `filterAndGeolocateNews` geocodes results serially in a for-loop after parallel LLM batches**
- File: `packages/server/src/lib/openai.ts:241`
- After running LLM batches in parallel, the function iterates over all results with `for (const item of allLlmItems)` and `await geocode(label, cityName)` serially. Nominatim has a 1 QPS rate limit, so geocoding 20+ labels takes 20+ seconds. The geocode function itself handles the rate gating, but each call blocks the next one, making the entire ingest-feeds run synchronously wait on geocoding.
- This isn't a correctness bug — it works — but it serializes what could be pipelined. The existing `geocode()` function's rate-gate means parallelism wouldn't help anyway, but clarifying this intent (a comment explaining the serial geocoding is intentional due to Nominatim 1 QPS) would reduce confusion.
- Recommendation: Add a comment at the serial geocoding loop explaining it is rate-limited by design. No structural change needed.

---

### Moderate

**M1 — `LOCATIONIQ_TOKEN` read at module load time — token rotation requires server restart**
- File: `packages/server/src/lib/geocode.ts:64`
- `const LOCATIONIQ_TOKEN = process.env.LOCATIONIQ_TOKEN;` is read once when the module is imported. If the token is rotated in the environment (e.g., on Render via env var update + zero-downtime restart), a rolling restart would still use the old value until a full restart. This is a minor ops concern.
- Recommendation: Read `process.env.LOCATIONIQ_TOKEN` inside `geocodeLocationIQ()` at call time rather than module scope.

**M2 — OpenAI cost estimate hardcoded for gpt-5-mini but used for both models**
- File: `packages/server/src/lib/openai.ts:377`
- `getUsageStats()` uses a comment `// Rough cost estimate for gpt-5-mini: $1.00/1M input, $4.00/1M output` and applies it universally, even though `filterAndGeolocateNews` uses `OPENAI_FILTER_MODEL` (default: `gpt-5-nano`) which has different pricing. The health endpoint reports misleading cost estimates.
- Recommendation: Track usage separately per model (key by model name, not city) or at least use separate cost constants for the filter model vs the summary model.

**M3 — `data-retention` runs orphan summary cleanup with a potentially expensive correlated subquery**
- File: `packages/server/src/cron/data-retention.ts:81`
- The orphan-summaries cleanup is `DELETE FROM ai_summaries WHERE headline_hash NOT IN (SELECT hash FROM news_items)`. As `news_items` accumulates up to ~1400 rows/day (7-day retention) and `ai_summaries` grows too, this `NOT IN` with a large subquery can be slow in PostgreSQL. PostgreSQL converts `NOT IN` to `NOT EXISTS` internally in most cases, but explicit `NOT EXISTS` or a `LEFT JOIN ... WHERE IS NULL` pattern tends to have better query plans for large tables.
- Recommendation: Rewrite as `DELETE FROM ai_summaries WHERE NOT EXISTS (SELECT 1 FROM news_items WHERE news_items.hash = ai_summaries.headline_hash)` for predictable performance.

**M4 — `ingest-events.ts` fetches only 7-day window from Kulturdaten but caches/returns 200 events for 6 hours**
- File: `packages/server/src/cron/ingest-events.ts:198`
- `fetchKulturdaten` hardcodes a 7-day lookahead window (`endDate = new Date(Date.now() + 7 * 86400_000)`), but the cache TTL is 6 hours and `MAX_FUTURE_EVENTS = 200`. For a "what's happening this week" panel this is reasonable, but if operators want to show a longer horizon it requires a code change rather than configuration.
- Recommendation: Make the lookahead window configurable via the `EventSourceConfig` in `CityDataSources`, defaulting to 14 days for richer event discovery.

**M5 — `CI.yml` has no turbo cache for the `lint` and `test` jobs**
- File: `.github/workflows/ci.yml`
- The `typecheck` and `build` jobs both use `actions/cache@v4` with a `turbo` cache key. The `lint` and `test` jobs do not. Turbo can cache lint and test results too, reducing CI time on unchanged packages.
- Recommendation: Add the same `actions/cache@v4` step with `path: .turbo` to the `lint` and `test` jobs.

**M6 — `CommandLayout.tsx` contains hardcoded ko-fi donation link and support copy**
- File: `packages/web/src/components/layout/CommandLayout.tsx:121`
- The ko-fi link (`https://ko-fi.com/OdinMB`) and support tile copy are hardcoded inline in the component rather than in config or i18n. The ko-fi URL won't be translated but the surrounding text should flow through i18n for consistency (Turkish and Arabic translations).
- Recommendation: Move the ko-fi URL to a config constant. The three i18n keys (`support.cost`, `support.ads`, `support.tracking`) are already handled — just the hardcoded "0" values and ko-fi URL are out of pattern.

**M7 — `loadEvents` reads ALL events for a city without a row limit**
- File: `packages/server/src/db/reads.ts:242`
- `loadEvents` does `SELECT * FROM events WHERE city_id = $1 ORDER BY date` with no limit. Events accumulate for 7 days × multiple sources. For cities with Ticketmaster + kulturdaten + gomus this could return hundreds of rows on every cache-miss read.
- Recommendation: Add `.limit(500)` consistent with the `MAX_FUTURE_EVENTS = 200` cap applied in the cron.

**M8 — Bootstrap endpoint response does not include bathing/pollen/wastewater/feuerwehr data from DB on cold cache**
- File: `packages/server/src/routes/news.ts:107` (bootstrap endpoint) and `packages/server/src/db/warm-cache.ts`
- The bootstrap endpoint returns `cache.getBatchWithMeta(CK.bootstrapKeys(city.id))` which only contains what's in cache. If the server cache is cold (e.g., just restarted without DB), the bootstrap returns nulls for all domains until each cron job runs. The warm-cache logic handles this on startup (via `warmCache()`), but if the cache TTL expires between cron runs the domains become null again. This is a design trade-off, but it means the DB fallback that exists per-route is never exercised by the bootstrap path.
- Recommendation: No structural change required, but document this known limitation in a comment at the bootstrap endpoint so future developers understand why route-level DB fallback exists but bootstrap doesn't have one.

---

### Nice to Have

**N1 — `ingest-safety.ts` `BERLIN_DISTRICTS` list is hardcoded in the cron — should come from city config**
- File: `packages/server/src/cron/ingest-safety.ts:26`
- The 22-element `BERLIN_DISTRICTS` list for district extraction is hardcoded in the cron file. Hamburg has its own districts that are never extracted. As new cities are added, this list will need updating in source code rather than config.
- Recommendation: Move district names into `CityDataSources.police` config as `districts?: string[]`, and fall back to the hardcoded list for Berlin to preserve existing behavior.

**N2 — `ingest-feeds.ts` cities are processed sequentially — parallelism available**
- File: `packages/server/src/cron/ingest-feeds.ts:46`
- `createFeedIngestion` iterates over active cities in a `for...of` loop with `await` inside. With 2 cities (Berlin + Hamburg), the 30-second deadline runs back-to-back rather than concurrently. Total worst-case feed ingestion time doubles.
- Recommendation: Switch to `Promise.allSettled(cities.map(city => ingestCityFeeds(...)))` for concurrent city processing.

**N3 — Shared `NewsItem` type is duplicated between `packages/server/src/cron/ingest-feeds.ts` and `packages/web/src/lib/api.ts`**
- Files: `packages/server/src/cron/ingest-feeds.ts:22`, `packages/web/src/lib/api.ts:44`
- Both define a `NewsItem` interface with the same shape. The server version has a `sourceUrl` and `lang` field that the web version omits, but the overlap is substantial. `shared/types.ts` is the right home for shared types; `NewsDigest` and `NewsItem` could be moved there.
- Recommendation: Lift `NewsItem` and `NewsDigest` into `shared/types.ts`, remove the duplicates, and re-export from both packages.

**N4 — `ingest-council-meetings.ts` uses sequential `for...of` with `await delay()` for PARDOK but the two PARDOK URLs could be parallel**
- File: `packages/server/src/cron/ingest-council-meetings.ts:207`
- `fetchPardokSchedules` uses `for (const [url, type] of [...])` which fetches the committee and plenary XML feeds sequentially. These are independent endpoints on the same server — they could be fetched concurrently with `Promise.all`.
- Recommendation: Refactor `fetchPardokSchedules` to use `Promise.all` for the two PARDOK endpoints.

**N5 — `CityMap.tsx` has 20+ `useRef` mirror vars for reactive state — component too large**
- File: `packages/web/src/components/map/CityMap.tsx`
- The component creates 20+ parallel `useRef` mirrors of reactive state (e.g., `isDarkRef`, `cityIdRef`, `transitItemsRef`, ...) to allow the map event handlers registered in `useEffect` to read current values. This is a correct pattern but it results in a 843-line component that is difficult to maintain. The pattern could be encapsulated.
- Recommendation: Extract the map initialization, layer update effects, and political layer logic into separate custom hooks (`useMapInit`, `useMapLayers`, `usePoliticalLayer`). Each hook would manage its own refs. This would reduce `CityMap.tsx` to a composition component.

**N6 — Rate limiting in `app.ts` is only applied globally and for bootstrap — no per-endpoint limits for heavy routes**
- File: `packages/server/src/app.ts:82`
- The global rate limit is `100 req/min` per IP. The bootstrap endpoint gets `10 req/min`. Routes for large payloads (social-atlas ~1.5MB GeoJSON, population GeoJSON) have no extra throttling. A single malicious or buggy client hammering `GET /api/berlin/social-atlas` 100 times/min would fetch ~150MB/min from memory.
- Recommendation: Apply a stricter rate limit (e.g., 20 req/min) to the social-atlas and population GeoJSON endpoints, similar to the bootstrap limit pattern already in place.

**N7 — No `Content-Security-Policy` header despite `helmet` middleware**
- File: `packages/server/src/app.ts:69`
- `app.use(helmet())` applies default Helmet headers but does not configure a `Content-Security-Policy`. The default Helmet CSP is disabled unless explicitly configured. While the API server itself serves no HTML, adding a CSP to the static frontend deployment (`packages/web`) via the Vite build headers or Render's response headers configuration would improve security posture.
- Recommendation: Add CSP headers in `render.yaml` for the static frontend. The API server's Helmet usage is fine as-is since it's JSON-only.

**N8 — `db/writes.ts` `saveSnapshot` casts `data: unknown` to `jsonb` without validation**
- File: `packages/server/src/db/writes.ts:41`
- `saveSnapshot` accepts `data: unknown` and directly passes it to Drizzle's INSERT. If a cron job accidentally passes `undefined` or a non-serializable value, the Postgres write will fail silently (caught in the cron's try/catch). There's no guard at the write boundary.
- Recommendation: Add a lightweight runtime check: `if (data == null) { log.warn('saveSnapshot: null data skipped'); return; }` to catch accidental null/undefined writes at the boundary.

---

## Summary Table

| ID | Priority | Area | One-line |
|---|---|---|---|
| C1 | Critical | Security/Dependencies | Replace abandoned `xlsx` package with `exceljs` |
| C2 | Critical | Error Handling | Replace raw `console.error` in CityMap political swap with proper logging |
| I1 | Important | Test Coverage | Add route tests for pollen, feuerwehr, council-meetings, noise-sensors |
| I2 | Important | Test Coverage | Add cron tests for `ingest-council-meetings` and `ingest-noise-sensors` |
| I3 | Important | Frontend/Correctness | Fix `isDesktop` stale-at-render using a proper `useIsDesktop` hook |
| I4 | Important | Performance | Parallelize BVV district fetching in council meetings ingest |
| I5 | Important | Performance/DB | Add row limit to `loadSafetyReports` to prevent unbounded reads |
| I6 | Important | Documentation | Document intentional serial geocoding loop due to Nominatim 1 QPS limit |
| M1 | Moderate | Ops/Config | Read `LOCATIONIQ_TOKEN` at call time, not module load time |
| M2 | Moderate | Observability | Track OpenAI usage by model, not just city |
| M3 | Moderate | Performance/DB | Replace `NOT IN` subquery in orphan-summary cleanup with `NOT EXISTS` |
| M4 | Moderate | Features | Make Kulturdaten event lookahead window configurable |
| M5 | Moderate | CI/DX | Add turbo cache to lint and test CI jobs |
| M6 | Moderate | Code Quality | Move hardcoded ko-fi URL to config constant |
| M7 | Moderate | Performance/DB | Add row limit to `loadEvents` |
| M8 | Moderate | Documentation | Document bootstrap endpoint DB-fallback gap in a comment |
| N1 | Nice-to-have | Extensibility | Move district name lists into city config |
| N2 | Nice-to-have | Performance | Parallelize per-city feed ingestion with `Promise.allSettled` |
| N3 | Nice-to-have | Code Quality | Deduplicate `NewsItem`/`NewsDigest` types into `shared/types.ts` |
| N4 | Nice-to-have | Performance | Parallelize two PARDOK XML fetches in `fetchPardokSchedules` |
| N5 | Nice-to-have | Maintainability | Decompose 843-line `CityMap.tsx` into custom hooks |
| N6 | Nice-to-have | Security | Add per-endpoint rate limits for large GeoJSON routes |
| N7 | Nice-to-have | Security | Add Content-Security-Policy header to static frontend on Render |
| N8 | Nice-to-have | Robustness | Add null guard in `saveSnapshot` to catch accidental null writes |
