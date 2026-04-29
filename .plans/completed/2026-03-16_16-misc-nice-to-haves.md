# Plan: Miscellaneous Nice-to-Haves

**Type:** refactor
**Complexity:** simple
**Files affected:** 9 (3 modified for type move, 2 for geocode cap, 1 for pharmacy warning, plus import updates)

## Overview

Three independent small improvements: geocode cache size cap, pharmacy token warning, and type consolidation for `CityEvent` and `SafetyReport`.

## Change 1: Geocode Cache Size Cap (N2)

**File:** `packages/server/src/lib/geocode.ts`

Add `MAX_ENTRIES = 10_000` constant near the cache declaration (line 106). Before every `geocodeCache.set(key, value)` call, check `geocodeCache.size >= MAX_ENTRIES` and if so, delete the first key (`geocodeCache.keys().next().value`). This applies to three `.set()` call sites:

1. Line 163 (DB lookup hit, populates in-process cache)
2. Line 197 (external API result)
3. `setGeocodeCacheEntry()` (line 114, used by warm-cache)

Extract a helper to avoid repetition:

```ts
const MAX_ENTRIES = 10_000;

function cacheSet(key: string, value: GeocodeResult | null): void {
  if (geocodeCache.size >= MAX_ENTRIES) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, value);
}
```

Replace all three `geocodeCache.set(...)` calls with `cacheSet(...)`. Also update `setGeocodeCacheEntry` to use `cacheSet`.

**Why FIFO via Map iteration order:** JavaScript Maps maintain insertion order, so `keys().next().value` gives the oldest entry. This is the simplest LRU-like eviction without adding a dependency. True LRU would require moving accessed keys to the end, but for a geocode cache where entries are stable landmarks, FIFO is sufficient.

## Change 2: Pharmacy Token Warning (N7)

**File:** `packages/server/src/cron/ingest-pharmacies.ts`

After the `APONET_TOKEN` declaration (line 20), add a module-level warning log:

```ts
if (!process.env.APONET_TOKEN) {
  log.warn('APONET_TOKEN not set — using hardcoded fallback token. Set APONET_TOKEN env var if the fallback stops working.');
}
```

This runs once at module load time (startup). No conditional logic needed around the token usage itself since the existing `??` fallback already handles it.

## Change 3: Consolidate CityEvent and SafetyReport to shared/types.ts (N1)

### Current state

Both types are defined in three places each (server ingestion, web api.ts, and context docs). The server and web definitions are identical.

**CityEvent** (identical in both):
- `packages/server/src/cron/ingest-events.ts` (lines 11-23) -- canonical definition
- `packages/web/src/lib/api.ts` (lines 53-65) -- duplicate

**SafetyReport** (identical in both):
- `packages/server/src/cron/ingest-safety.ts` (lines 14-22) -- canonical definition
- `packages/web/src/lib/api.ts` (lines 67-75) -- duplicate

### Steps

1. **Add to `shared/types.ts`:** Add both interfaces after the existing `NewsDigest` block (around line 475), before the council meetings re-export.

2. **Update `packages/server/src/cron/ingest-events.ts`:**
   - Remove the `CityEvent` interface definition (lines 11-23)
   - Add `import type { CityEvent } from '@city-monitor/shared';`
   - Keep the `export type { CityEvent };` re-export so downstream server imports don't break

3. **Update `packages/server/src/cron/ingest-safety.ts`:**
   - Remove the `SafetyReport` interface definition (lines 14-22)
   - Add `import type { SafetyReport } from '@city-monitor/shared';`
   - Keep the `export type { SafetyReport };` re-export

4. **Update `packages/web/src/lib/api.ts`:**
   - Remove both `CityEvent` and `SafetyReport` interface definitions (lines 53-75)
   - Add `import type { CityEvent, SafetyReport } from '@city-monitor/shared';`
   - Keep the re-exports so downstream web imports don't break

5. **No changes needed** to any other importing files -- they all import from the ingestion files or api.ts, which will re-export from shared.

### Files modified (Change 3)

| File | Action |
|---|---|
| `shared/types.ts` | Add `CityEvent` and `SafetyReport` interfaces |
| `packages/server/src/cron/ingest-events.ts` | Remove definition, import from shared, re-export |
| `packages/server/src/cron/ingest-safety.ts` | Remove definition, import from shared, re-export |
| `packages/web/src/lib/api.ts` | Remove both definitions, import from shared, re-export |

## Verification

- `npm run typecheck` must pass (confirms all imports resolve)
- No runtime changes expected -- these are all type-level or logging-only changes except the geocode cap

## Summary of all files touched

1. `packages/server/src/lib/geocode.ts` -- add MAX_ENTRIES cap
2. `packages/server/src/cron/ingest-pharmacies.ts` -- add startup warning
3. `shared/types.ts` -- add CityEvent + SafetyReport
4. `packages/server/src/cron/ingest-events.ts` -- import from shared
5. `packages/server/src/cron/ingest-safety.ts` -- import from shared
6. `packages/web/src/lib/api.ts` -- import from shared
