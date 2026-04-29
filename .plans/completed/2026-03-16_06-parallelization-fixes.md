# Plan: Parallelization Improvements for Server Ingestion

Type: refactor
Complexity: simple

## Summary

Three targeted parallelization improvements to reduce total ingestion time in two cron job files. No new dependencies, no schema changes, no frontend changes.

## Changes

### 1. Concurrent city feed ingestion (`ingest-feeds.ts`)

**File:** `packages/server/src/cron/ingest-feeds.ts`
**Lines:** 44-53

**Current:** Sequential `for...of` loop over cities.
**Target:** `Promise.allSettled(cities.map(...))` for concurrent city processing.

Replace:
```typescript
for (const city of cities) {
  try {
    await ingestCityFeeds(city, cache, db);
  } catch (err) {
    log.error(`${city.id} failed`, err);
  }
}
```

With:
```typescript
const results = await Promise.allSettled(
  cities.map((city) => ingestCityFeeds(city, cache, db)),
);
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  if (r.status === 'rejected') {
    log.error(`${cities[i].id} failed`, r.reason);
  }
}
```

**Why this is safe:** Each city has its own cache keys (namespaced by `city.id`), its own DB writes (scoped by city), and its own `CITY_DEADLINE` timeout. The feeds within a city are already fetched concurrently (the `CONCURRENCY=8` pool). There is no shared mutable state between cities.

### 2. Parallel PARDOK XML fetches (`ingest-council-meetings.ts`)

**File:** `packages/server/src/cron/ingest-council-meetings.ts`
**Function:** `fetchPardokSchedules` (lines 199-222)

**Current:** Sequential `for...of` loop over the two URLs (committee, plenary).
**Target:** `Promise.allSettled` to fetch both in parallel, with individual error handling preserved.

Replace the loop body with:
```typescript
const fetches = ([
  [committeeUrl, 'committee'],
  [plenaryUrl, 'plenary'],
] as const).map(async ([url, type]) => {
  const res = await log.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    log.warn(`PARDOK ${type} returned ${res.status}`);
    return [];
  }
  const text = await res.text();
  return parsePardokXml(text, type, now, windowMs);
});

const results = await Promise.allSettled(fetches);
for (const r of results) {
  if (r.status === 'fulfilled') {
    meetings.push(...r.value);
  } else {
    log.warn(`PARDOK fetch failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }
}
```

### 3. Rate-gated concurrent BVV district fetching (`ingest-council-meetings.ts`)

**File:** `packages/server/src/cron/ingest-council-meetings.ts`
**Lines:** 244-253

**Current:** Sequential loop with 1s `delay()` between each district (11 districts = 11+ seconds serial).
**Target:** Launch all district fetches concurrently, each gated through `createRateGate(1000)` so requests are staggered at 1s intervals. The rate gate serializes the actual HTTP calls while allowing all the promise machinery to be set up concurrently.

Add import:
```typescript
import { createRateGate } from '../lib/rate-gate.js';
```

Replace the BVV loop with:
```typescript
const gate = createRateGate(DELAY_BETWEEN_DISTRICTS_MS);

const bvvResults = await Promise.allSettled(
  cfg.bvv.map(async (district) => {
    await gate();
    const meetings = await fetchOparlMeetings(district.baseUrl, district.district, now, windowMs);
    log.info(`${city.id} ${district.district}: ${meetings.length} meetings`);
    return meetings;
  }),
);

for (const r of bvvResults) {
  if (r.status === 'fulfilled') {
    allMeetings.push(...r.value);
  } else {
    log.warn(`BVV OParl failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }
}
```

**How this works:** All 11 district promises are created immediately. They all call `gate()` which queues them with 1s spacing. The first call proceeds immediately; the second waits ~1s; the third ~2s, etc. Each district's multi-page OParl pagination then runs to completion before that promise resolves. The key difference from the current approach: if district A takes 3s of pagination, district B (which started 1s later) may finish its pagination before A does, and district C can start while both are still paginating. Net effect: total time is closer to max(individual_times) + N seconds of gate delay, rather than sum(individual_times) + N seconds of delay.

**Cleanup:** Remove the now-unused `delay` helper function and `DELAY_BETWEEN_DISTRICTS_MS` can stay (it's used by `createRateGate`). Actually, keep `DELAY_BETWEEN_DISTRICTS_MS` as-is since it's still referenced.

## Files Affected

| File | Change |
|---|---|
| `packages/server/src/cron/ingest-feeds.ts` | Replace sequential city loop with `Promise.allSettled` |
| `packages/server/src/cron/ingest-council-meetings.ts` | Parallel PARDOK fetches, rate-gated concurrent BVV, add `createRateGate` import, remove `delay` helper |

## Testing

- Run existing tests: `npx turbo run test`
- Type-check: `npm run typecheck`
- Manual: verify logs show interleaved city/district processing on next cron cycle

## Risks

- **Low risk.** All three changes are isolated to ingestion orchestration. The underlying fetch/parse/persist logic is untouched. Error handling is preserved (or improved) via `Promise.allSettled` which never throws.
- The BVV rate gate ensures we still respect the 1s politeness delay to OParl servers.
- If two cities share an external API with rate limits, concurrent city processing could hit those limits faster. However, each city targets different API endpoints (Berlin feeds vs Hamburg feeds), so this is not a concern in practice.
