# Plan 03: Rewrite cache.ts (Remove worldmonitor derivation)

## Goal

Rewrite the in-memory cache module from scratch, removing the structural derivation from worldmonitor's Redis cache layer.

## Context

`packages/server/src/lib/cache.ts` was adapted from worldmonitor's `server/_shared/redis.ts`. While the implementation is completely different (in-memory Map vs HTTP-based Upstash Redis), the `fetch()` method's API shape and the in-flight coalescing + negative sentinel pattern were clearly lifted from the original's `cachedFetchJson`.

## Callers

This is the most heavily used module — imported by virtually every route and cron job (30+ files). The public API:

- `createCache()` → returns `{ get, set, delete, fetch, getBatch, size, clear }`
- `Cache` type (exported as `ReturnType<typeof createCache>`)

## Decision

Fresh hand-rolled Map implementation. Same public API, independent internals, zero new dependencies, no importer changes needed.

## Steps

1. Rewrite `packages/server/src/lib/cache.ts` from scratch
   - Same public API: `createCache()` returning `{ get, set, delete, fetch, getBatch, size, clear }`
   - Independent internal structure
   - Remove negative sentinel pattern — instead, cache `null` results directly with a shorter TTL
   - Implement request dedup via a simple `Map<string, Promise>` (standard pattern, no structural similarity to original needed)
2. Replace the attribution header with the standard new-code header
3. Run `warm-cache.test.ts`, `ingest-feeds.test.ts`, and other tests that create caches
4. Verify the cache still works in dev: bootstrap endpoint returns data, cron jobs populate cache

## Notes

- The `Cache` type signature must remain compatible — all 30+ importers use `Cache` as a type
- The `fetch()` method signature stays: `fetch<T>(key, ttlSeconds, fetcher, negativeTtlSeconds?) → Promise<T | null>`
- Internal implementation details (how coalescing works, how TTL is checked) should differ from the original
