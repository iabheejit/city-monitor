# Plan 13: Parallelize safety ingestion and data retention cron jobs

Type: refactor
Complexity: simple

## Goal

Replace sequential `for...of` loops with `Promise.allSettled` in two cron files to run independent async operations in parallel, matching the pattern already established in `ingest-feeds.ts`.

## M1: Parallelize city loop in `ingest-safety.ts`

**File:** `packages/server/src/cron/ingest-safety.ts`

**Current code (lines 29-36):** Sequential `for...of` over cities with try/catch per city.

**Change:** Replace lines 29-36 in `createSafetyIngestion` with the `Promise.allSettled` pattern from `ingest-feeds.ts` (lines 27-36):

```ts
const results = await Promise.allSettled(
  cities
    .filter((city) => city.dataSources.police)
    .map((city) =>
      ingestCitySafety(city.id, city.name, city.dataSources.police!, cache, db),
    ),
);
for (const r of results) {
  if (r.status === 'rejected') {
    log.error('city safety ingestion failed', r.reason);
  }
}
```

**Notes:**
- The `filter` before `map` replaces the `if (!city.dataSources.police) continue` guard from the sequential version.
- The non-null assertion (`!`) on `city.dataSources.police` is safe because of the preceding filter.
- The error logging in the `for` loop over results replaces the per-city try/catch. We lose the city ID in the error message at the outer level, but `ingestCitySafety` already logs city-specific errors internally (lines 106-108 for DB write failures, etc.). To preserve city ID in the outer error log, we can keep a parallel `filteredCities` array and index into it, matching the pattern in `ingest-feeds.ts`:

```ts
const eligible = cities.filter((city) => city.dataSources.police);
const results = await Promise.allSettled(
  eligible.map((city) =>
    ingestCitySafety(city.id, city.name, city.dataSources.police!, cache, db),
  ),
);
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  if (r.status === 'rejected') {
    log.error(`${eligible[i].id} failed`, r.reason);
  }
}
```

This second form is preferred because it preserves the city ID in error logs, exactly matching the `ingest-feeds.ts` pattern.

## M2: Parallelize delete tasks in `data-retention.ts`

**File:** `packages/server/src/cron/data-retention.ts`

**Current code (lines 92-99):** Sequential `for...of` over `tasks` array, incrementing `cleaned` on success.

**Change:** Replace lines 92-99 with:

```ts
const results = await Promise.allSettled(tasks.map((t) => t.fn()));
let cleaned = 0;
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  if (r.status === 'fulfilled') {
    cleaned++;
  } else {
    log.error(`cleanup ${tasks[i].name} failed`, r.reason);
  }
}
```

Also remove the `let cleaned = 0;` declaration on line 61 since it moves into the block after `Promise.allSettled`.

**Consideration:** All 28+ delete queries will hit Postgres concurrently. This is fine because:
- DELETE queries on different table/type partitions don't contend with each other.
- This runs once daily (or less frequently) during low-traffic hours.
- PostgreSQL handles concurrent deletes well; each targets a different subset of rows.
- The alternative of batching (e.g., 5 at a time) adds complexity for negligible benefit on ~28 lightweight deletes.

## Files affected

1. `packages/server/src/cron/ingest-safety.ts` -- lines 29-36 replaced
2. `packages/server/src/cron/data-retention.ts` -- lines 61, 92-99 replaced

## Testing

- Run `npx turbo run typecheck` to verify no type errors.
- Run `npx turbo run test --filter=@city-monitor/server` to verify no test regressions.
- No new tests needed: this is a behavioral-equivalent refactor (same operations, just concurrent).
