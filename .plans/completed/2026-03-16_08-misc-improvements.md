# Plan 08: Miscellaneous Improvements

**Type:** refactor
**Complexity:** simple (4 independent, low-risk changes)

---

## Change 1: Per-endpoint rate limits for heavy GeoJSON routes

**Problem:** The social-atlas and population endpoints return large GeoJSON payloads (choropleth map data). They share the global 100 req/min limit, which is too generous for these expensive responses.

**Approach:** Add dedicated `rateLimit()` middleware for these routes in `app.ts`, following the existing bootstrap rate-limit pattern (lines 211-214). Apply the same limit to both the social-atlas and population GeoJSON routes.

### Files to change

- `packages/server/src/app.ts`

### Implementation

After the existing bootstrap rate limit block (line 214), add a second block:

```ts
// Stricter rate limit for heavy GeoJSON payloads — skip in dev
if (!isDev) {
  const geojsonLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
  app.use('/api/:city/social-atlas', geojsonLimit);
  app.use('/api/:city/population', geojsonLimit);
}
```

Use the same `max: 10` as bootstrap since these are similarly heavy. A single shared limiter instance means the 10 requests/min is shared across both routes per IP, which is the desired behavior (prevents a client from hammering both endpoints simultaneously).

**Alternatives considered:** Separate limiter per route (rejected -- overkill, these are rarely hit), lower limit like max: 5 (rejected -- the frontend may request both endpoints plus the population/summary sub-route, so 10 is safer).

---

## Change 2: Track OpenAI usage by model for accurate cost estimates

**Problem:** `getUsageStats()` tracks usage keyed only by city. The cost estimate hardcodes gpt-5-mini pricing, but the filter/geolocate calls use gpt-5-nano (different pricing). This produces inaccurate cost estimates on the health endpoint.

**Approach:** Change the usage tracking key from `cityId` to `model:cityId` (composite key), and store the model name alongside token counts. Update `getUsageStats()` to apply model-specific pricing.

### Files to change

- `packages/server/src/lib/openai.ts`

### Implementation

1. Add `model` to `UsageEntry`:
   ```ts
   interface UsageEntry {
     model: string;
     input: number;
     output: number;
     calls: number;
   }
   ```

2. Change `trackUsage` signature to accept model:
   ```ts
   function trackUsage(key: string, model: string, input: number, output: number): void {
     const compositeKey = `${model}:${key}`;
     if (!usage[compositeKey]) usage[compositeKey] = { model, input: 0, output: 0, calls: 0 };
     usage[compositeKey].input += input;
     usage[compositeKey].output += output;
     usage[compositeKey].calls += 1;
   }
   ```

3. Update all 3 call sites to pass the model name:
   - `summarizeHeadlines` (line 97): `trackUsage(cityName.toLowerCase(), model, inTok, outTok)`
   - `filterAndGeolocateNews` (line 234): `trackUsage(cityId, filterModel, totalInTok, totalOutTok)`
   - `geolocateReports` (line 328): `trackUsage(cityId, filterModel, inTok, outTok)`

4. Update `getUsageStats()` to use per-model pricing:
   ```ts
   const MODEL_PRICING: Record<string, { input: number; output: number }> = {
     'gpt-5-mini': { input: 1.00, output: 4.00 },   // per 1M tokens
     'gpt-5-nano': { input: 0.10, output: 0.40 },    // per 1M tokens
   };
   const DEFAULT_PRICING = { input: 1.00, output: 4.00 }; // fallback

   export function getUsageStats(): Record<string, UsageEntry & { estimatedCostUsd: number }> {
     const result: Record<string, UsageEntry & { estimatedCostUsd: number }> = {};
     for (const [key, entry] of Object.entries(usage)) {
       const pricing = MODEL_PRICING[entry.model] ?? DEFAULT_PRICING;
       const cost = (entry.input * pricing.input / 1_000_000) + (entry.output * pricing.output / 1_000_000);
       result[key] = { ...entry, estimatedCostUsd: Math.round(cost * 10000) / 10000 };
     }
     return result;
   }
   ```

The health endpoint output format changes from `{ berlin: {...} }` to `{ "gpt-5-mini:berlin": {...}, "gpt-5-nano:berlin": {...} }`. This is a non-breaking change since the health endpoint is an internal diagnostic tool, not consumed by the frontend.

**Alternatives considered:** Keep city-level aggregation and add a sub-breakdown by model (rejected -- more complex, and the composite key is simpler and gives the same information). Use a nested structure `{ berlin: { "gpt-5-mini": {...} } }` (rejected -- the flat composite key is simpler and works well for a diagnostic endpoint).

---

## Change 3: Move BERLIN_DISTRICTS to city config

**Problem:** `BERLIN_DISTRICTS` is hardcoded in `ingest-safety.ts` and only works for Berlin. Hamburg police reports get no district extraction at all.

**Approach:** Add an optional `districts` field to the `police` config in `CityDataSources`. Move the Berlin districts list into `berlin.ts` config. Update `ingest-safety.ts` to read districts from the city config and pass them to `extractDistrict()`.

### Files to change

1. `shared/types.ts` -- add `districts?: string[]` to the `police` interface
2. `packages/server/src/config/cities/berlin.ts` -- add districts to `police` config
3. `packages/server/src/config/cities/hamburg.ts` -- add Hamburg Bezirke to `police` config
4. `packages/server/src/cron/ingest-safety.ts` -- remove hardcoded list, read from config

### Implementation

1. In `shared/types.ts`, update the police field:
   ```ts
   police?: { provider: 'rss'; url: string; districts?: string[] };
   ```

2. In `berlin.ts`, expand the police config:
   ```ts
   police: {
     provider: 'rss',
     url: 'https://www.berlin.de/presse/pressemitteilungen/index/feed?institutions[]=Polizei+Berlin',
     districts: [
       'Mitte', 'Friedrichshain', 'Kreuzberg', 'Pankow', 'Prenzlauer Berg',
       'Charlottenburg', 'Wilmersdorf', 'Spandau', 'Steglitz', 'Zehlendorf',
       'Tempelhof', 'Schöneberg', 'Neukölln', 'Treptow', 'Köpenick',
       'Marzahn', 'Hellersdorf', 'Lichtenberg', 'Reinickendorf', 'Wedding',
       'Moabit', 'Tiergarten',
     ],
   },
   ```

3. In `hamburg.ts`, add Hamburg districts:
   ```ts
   police: {
     provider: 'rss',
     url: 'https://www.presseportal.de/rss/dienststelle_6013.rss2',
     districts: [
       'Altona', 'Bergedorf', 'Eimsbüttel', 'Harburg', 'Mitte',
       'Nord', 'Wandsbek', 'St. Pauli', 'Ottensen', 'Barmbek',
       'Blankenese', 'Winterhude', 'Eppendorf', 'Bramfeld', 'Rahlstedt',
     ],
   },
   ```

4. In `ingest-safety.ts`:
   - Remove the `BERLIN_DISTRICTS` constant (lines 26-32)
   - Pass the police config to `ingestCitySafety` instead of just the URL
   - Update `extractDistrict` to accept a districts array parameter
   - If no districts configured, skip district extraction (return undefined)

   ```ts
   // In createSafetyIngestion loop:
   await ingestCitySafety(city.id, city.name, city.dataSources.police, cache, db);

   // Updated signature:
   async function ingestCitySafety(cityId: string, cityName: string, policeConfig: { url: string; districts?: string[] }, cache: Cache, db: Db | null)

   // Updated extractDistrict:
   function extractDistrict(title: string, districts?: string[]): string | undefined {
     if (!districts) return undefined;
     for (const district of districts) {
       if (title.includes(district)) return district;
     }
     return undefined;
   }
   ```

**Alternatives considered:** Add a separate `districts` field at the top level of CityConfig (rejected -- districts here are only used for police report parsing, so they belong with the police config). Use a map of city-id to districts in the safety module (rejected -- doesn't follow the data-sources-in-config pattern).

---

## Change 4: Move ko-fi URL to config constant

**Problem:** The ko-fi donation URL `https://ko-fi.com/OdinMB` is hardcoded in 3 places across the frontend.

**Approach:** Create a `packages/web/src/lib/constants.ts` file with a `SUPPORT_URL` constant. Replace all 3 hardcoded occurrences.

### Files to change

1. `packages/web/src/lib/constants.ts` (new file)
2. `packages/web/src/components/layout/CommandLayout.tsx` (line 122)
3. `packages/web/src/components/layout/Footer.tsx` (line 20)
4. `packages/web/src/pages/NoTrackingPage.tsx` (line 115)

### Implementation

1. Create `packages/web/src/lib/constants.ts`:
   ```ts
   /** Ko-fi donation/support page URL */
   export const SUPPORT_URL = 'https://ko-fi.com/OdinMB';
   ```

2. In each of the 3 files, import and use the constant:
   ```ts
   import { SUPPORT_URL } from '../../lib/constants.js';
   // ...
   href={SUPPORT_URL}
   ```

**Alternatives considered:** Put it in an env variable (rejected -- it's not secret/environment-specific, a constant is simpler). Put it in a shared package config (rejected -- it's frontend-only).

---

## Summary of all files changed

| # | File | Change |
|---|------|--------|
| 1 | `packages/server/src/app.ts` | Add GeoJSON rate limit block |
| 2 | `packages/server/src/lib/openai.ts` | Track by model, model-specific pricing |
| 3 | `shared/types.ts` | Add `districts?` to police config |
| 4 | `packages/server/src/config/cities/berlin.ts` | Add districts to police |
| 5 | `packages/server/src/config/cities/hamburg.ts` | Add districts to police |
| 6 | `packages/server/src/cron/ingest-safety.ts` | Use config districts, remove hardcoded list |
| 7 | `packages/web/src/lib/constants.ts` | New file with SUPPORT_URL |
| 8 | `packages/web/src/components/layout/CommandLayout.tsx` | Use SUPPORT_URL constant |
| 9 | `packages/web/src/components/layout/Footer.tsx` | Use SUPPORT_URL constant |
| 10 | `packages/web/src/pages/NoTrackingPage.tsx` | Use SUPPORT_URL constant |

## Testing

- **Rate limits:** Manual test in dev isn't needed (rate limits are skipped in dev). Verify the code compiles with `npm run typecheck`.
- **OpenAI tracking:** Check the `/api/health` endpoint after deployment to confirm the new key format.
- **Districts:** Run `npm run typecheck` to confirm the type change propagates. The existing safety ingestion behavior for Berlin is unchanged (same list).
- **Ko-fi URL:** Run `npm run typecheck` and verify no broken imports.

All 4 changes are independent and can be committed together or separately.
