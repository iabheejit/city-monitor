# Plan 32: Operations & Maintenance Improvements

**Type:** refactor / ops
**Complexity:** simple (3 independent, low-risk changes)

---

## Item 1: Extend Hamburg districts list

**File:** `packages/server/src/config/cities/hamburg.ts`

**Problem:** The current list has only 15 entries (7 Bezirke + 8 well-known Stadtteile). Police reports from presseportal.de often mention specific Stadtteile not in the list, so `extractDistrict()` in `ingest-safety.ts` returns `undefined` and the report has no district tag.

**Approach:** Expand the `districts` array to include all 7 Bezirke and the most prominent Stadtteile from each. Hamburg has 104 Stadtteile officially, but many are very small and unlikely to appear in police reports. We include the ~60 most recognizable ones that a police press release would plausibly mention.

The extraction function (`extractDistrict` in `ingest-safety.ts`) does a simple `title.includes(district)` check, so:
- Order matters: more specific names must come before substrings (e.g., "Barmbek-Nord" before "Barmbek", "St. Georg" before standalone match issues). Actually, since it returns the first match, longer/more-specific entries should come first.
- Avoid names that are common German words or would cause false positives.

**New districts list** (organized by Bezirk):

```
// Bezirke (top-level)
'Altona', 'Bergedorf', 'Eimsbüttel', 'Harburg', 'Hamburg-Mitte', 'Hamburg-Nord', 'Wandsbek',

// Altona Stadtteile
'Ottensen', 'Bahrenfeld', 'Blankenese', 'Osdorf', 'Lurup', 'Sülldorf', 'Rissen',
'Nienstedten', 'Groß Flottbek', 'Othmarschen', 'Altona-Altstadt', 'Altona-Nord',

// Bergedorf Stadtteile
'Lohbrügge', 'Allermöhe', 'Billwerder', 'Curslack', 'Kirchwerder', 'Neuallermöhe',

// Eimsbüttel Stadtteile
'Eidelstedt', 'Stellingen', 'Lokstedt', 'Niendorf', 'Schnelsen', 'Rotherbaum',
'Harvestehude', 'Hoheluft-West',

// Harburg Stadtteile
'Wilhelmsburg', 'Neugraben-Fischbek', 'Hausbruch', 'Heimfeld', 'Moorburg',
'Neuland', 'Harburg (Stadtteil)',

// Hamburg-Mitte Stadtteile
'St. Pauli', 'St. Georg', 'HafenCity', 'Hammerbrook', 'Borgfelde', 'Hamm',
'Horn', 'Billstedt', 'Billbrook', 'Rothenburgsort', 'Veddel', 'Wilhelmsburg',
'Neustadt', 'Finkenwerder',

// Hamburg-Nord Stadtteile
'Winterhude', 'Eppendorf', 'Barmbek-Nord', 'Barmbek-Süd', 'Uhlenhorst',
'Hohenfelde', 'Dulsberg', 'Alsterdorf', 'Ohlsdorf', 'Fuhlsbüttel',
'Langenhorn', 'Groß Borstel', 'Hoheluft-Ost',

// Wandsbek Stadtteile
'Bramfeld', 'Rahlstedt', 'Farmsen-Berne', 'Tonndorf', 'Jenfeld', 'Marienthal',
'Wandsbek (Stadtteil)', 'Steilshoop', 'Wellingsbüttel', 'Sasel', 'Poppenbüttel',
'Hummelsbüttel', 'Bergstedt', 'Duvenstedt', 'Wohldorf-Ohlstedt', 'Volksdorf',
'Eilbek'
```

**Note on ordering:** Place compound/longer names before their shorter components:
- `Barmbek-Nord`, `Barmbek-Süd` before `Barmbek`
- `Altona-Altstadt`, `Altona-Nord` before `Altona`
- `Hamburg-Mitte` before `Mitte` (currently just `Mitte` -- rename to `Hamburg-Mitte` since bare "Mitte" in Hamburg police reports is ambiguous)
- `Hamburg-Nord` before `Nord`

Wait -- the current list has `Mitte` and `Nord`. For Hamburg police reports, "Mitte" almost certainly refers to the Bezirk "Hamburg-Mitte". However, `extractDistrict` does `title.includes(district)` so `Mitte` would match "Hamburg-Mitte" in a title. The risk is false positives on the word "Mitte" appearing in other contexts ("in der Mitte der Straße"). Rename to `Hamburg-Mitte` and `Hamburg-Nord` for specificity -- police press releases typically use the full Bezirk name.

**Alternative considered:** Keep `Mitte`/`Nord` as-is for backward compatibility. Rejected because false-positive matches on common German words reduce data quality, and there is no stored historical data depending on the exact district string (districts are extracted fresh each ingestion cycle).

### Changes

1. Replace the `districts` array in `hamburg.ts` with the comprehensive list (~70 entries).
2. Order entries so longer/compound names come before shorter substrings.

---

## Item 2: Per-endpoint rate limits for AEDs and Budget

**File:** `packages/server/src/app.ts`

**Problem:** The social-atlas and population endpoints already have a stricter `geojsonLimit` (10 req/min) because they serve large GeoJSON payloads. The AEDs endpoint also serves a full GeoJSON-like array of all AED locations (potentially hundreds), and the budget endpoint serves a large data object. Both should have stricter rate limits to prevent abuse.

**Approach:** Add AEDs and budget to the existing `geojsonLimit` block in `app.ts`. They already have the same rate limit shape (10 req/min), so we just add two more `app.use()` lines in the existing `if (!isDev)` block.

**Alternative considered:** Creating a separate, less strict rate limiter for budget (since it's not GeoJSON). Rejected because the payload sizes are comparable and the 10 req/min limit is reasonable for any heavy endpoint. Using the same limiter instance also means they share the rate limit window, which is actually the desired behavior -- a single client hammering multiple heavy endpoints should still be throttled.

**Wait -- actually each `app.use()` call with the same `rateLimit()` instance shares the counter.** Let me re-check.

Looking at the code: `geojsonLimit` is a single limiter instance applied to multiple routes. With `express-rate-limit`, each middleware instance has its own store, so all four routes (social-atlas, population, aeds, budget) would share the same 10 req/min counter. That's actually fine -- it means a client can make 10 requests total across all heavy endpoints per minute, which is a stricter but reasonable policy.

If we wanted independent limits per endpoint, we'd create separate `rateLimit()` instances. But shared is better here -- it's a combined "heavy endpoint budget" per client.

Rename the variable from `geojsonLimit` to `heavyPayloadLimit` for clarity since budget isn't GeoJSON.

### Changes

1. In `app.ts`, rename `geojsonLimit` to `heavyPayloadLimit`.
2. Add `app.use('/api/:city/aeds', heavyPayloadLimit)` and `app.use('/api/:city/budget', heavyPayloadLimit)` in the existing `if (!isDev)` block.

---

## Item 3: Move bootstrap endpoint to its own route file

**Files:**
- `packages/server/src/routes/bootstrap.ts` (new)
- `packages/server/src/routes/news.ts` (remove bootstrap handler)
- `packages/server/src/app.ts` (import and mount new router)
- `packages/server/src/routes/news.test.ts` (move bootstrap tests)
- `packages/server/src/routes/bootstrap.test.ts` (new)

**Problem:** The bootstrap endpoint (`GET /:city/bootstrap`) is in `news.ts` but it serves all city data, not just news. This is confusing for maintainability.

**Approach:** Extract the bootstrap handler into `packages/server/src/routes/bootstrap.ts` with a `createBootstrapRouter(cache)` function. The bootstrap endpoint only needs the cache (no DB -- it's cache-only by design, as noted in the existing comment).

### Changes

1. Create `packages/server/src/routes/bootstrap.ts`:
   - Export `createBootstrapRouter(cache: Cache)`.
   - Move the `/:city/bootstrap` handler from `news.ts`.
   - Import `getCityConfig` and `CK` (same deps as current code).

2. Update `packages/server/src/routes/news.ts`:
   - Remove the bootstrap handler (lines 107-142).
   - No other changes needed.

3. Update `packages/server/src/app.ts`:
   - Add `import { createBootstrapRouter } from './routes/bootstrap.js'`.
   - Add `app.use('/api', cacheFor(60), createBootstrapRouter(cache));` -- use a short cache time (60s) since bootstrap aggregates data with varying freshness.
   - Mount it before other city routes so it's clearly visible.

4. Create `packages/server/src/routes/bootstrap.test.ts`:
   - Move the 3 bootstrap tests from `news.test.ts`.
   - Same test setup pattern (createApp, listen, cleanup).

5. Update `packages/server/src/routes/news.test.ts`:
   - Remove the 3 bootstrap tests.

**Cache-Control for bootstrap:** Currently bootstrap inherits `cacheFor(300)` from the news router mount. The bootstrap response contains data with different freshness levels (weather at 300s, traffic at 120s, etc.). A 60-second Cache-Control is more appropriate since it's an initial load endpoint. Changed from 300 to 60.

**Alternative considered:** Keep 300s to match current behavior. Chose 60s because bootstrap is the initial page load and should be relatively fresh; the individual endpoints handle their own caching for subsequent polling.

---

## Implementation Order

All three items are independent. They can be implemented in any order or in parallel. Suggested order:

1. **Item 3** (bootstrap extraction) -- most structural, get it done first
2. **Item 2** (rate limits) -- 2-line change in app.ts
3. **Item 1** (Hamburg districts) -- data-only change, largest diff but lowest risk

## Files Affected Summary

| File | Action |
|------|--------|
| `packages/server/src/config/cities/hamburg.ts` | Modify (expand districts) |
| `packages/server/src/app.ts` | Modify (rate limits + bootstrap import) |
| `packages/server/src/routes/bootstrap.ts` | Create |
| `packages/server/src/routes/bootstrap.test.ts` | Create |
| `packages/server/src/routes/news.ts` | Modify (remove bootstrap) |
| `packages/server/src/routes/news.test.ts` | Modify (remove bootstrap tests) |

**Total: 6 files (4 modified, 2 new)**
