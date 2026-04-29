# Plan 23 — Small Fixes Batch 2

**Type:** bugfix + refactor
**Complexity:** simple
**Files affected:** 6

Six independent, targeted fixes. No architectural changes, no new dependencies, no migrations.

---

## Fix 1 (IMP-3): Replace hardcoded `'berlin'` in warm-cache

**File:** `packages/server/src/db/warm-cache.ts` lines 134-174

The block is already guarded by `cityId === 'berlin'`, but every call inside passes the literal `'berlin'` instead of `cityId`. Replace all 16 occurrences of the `'berlin'` literal (in function args and cache keys) with `cityId`. Also update error log strings to include `${cityId}` prefix for consistency with the rest of the file.

**Changes (lines 136-173):**
- `loadWastewater(db, 'berlin')` -> `loadWastewater(db, cityId)`
- `CK.wastewaterSummary('berlin')` -> `CK.wastewaterSummary(cityId)`
- Same pattern for: bathingSpots, laborMarket, populationGeojson, populationSummary, feuerwehr, noiseSensors, councilMeetings (8 load calls + 8 cache key calls = 16 replacements)
- Error logs: `'wastewater failed'` -> `` `${cityId} wastewater failed` `` (8 error strings)

---

## Fix 2 (IMP-4): Silence console.warn for political GeoJSON swap

**File:** `packages/web/src/components/map/CityMap.tsx` line 700

Replace:
```ts
console.warn('[political] GeoJSON swap error:', e);
```
With:
```ts
// Swap failure is non-critical — falls back to default district layer
```

---

## Fix 3 (MOD-2): Simplify `isDwdSource`

**File:** `packages/server/src/cron/ingest-nina.ts` lines 118-122

The third condition (`warning.transKeys?.event?.startsWith('BBK-EVC-0') === false && warning.id?.includes('.dwd.') === true`) is confusing and unreliable with optional-chaining producing `undefined`. Simplify to just the two clear prefix checks.

Replace with:
```ts
export function isDwdSource(warning: DashboardWarning): boolean {
  return (warning.id?.startsWith('dwd.') ?? false) ||
    (warning.type?.toLowerCase().includes('dwd') ?? false);
}
```

Note: Adding `?? false` ensures the return type is strictly `boolean` even when `id` or `type` is undefined/null.

---

## Fix 4 (MOD-6): Handle CRLF in BriefingStrip paragraph splitting

**File:** `packages/web/src/components/strips/BriefingStrip.tsx` line 11

Replace:
```ts
const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
```
With:
```ts
const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
```

---

## Fix 5 (MOD-7): Early return in useFreshness when fetchedAt is null

**File:** `packages/web/src/hooks/useFreshness.ts`

Move the `if (!fetchedAt)` early return before the useEffect so that interval + visibilitychange listeners are not attached when there is no timestamp to track. Since React hooks must be called unconditionally, restructure by keeping the `useState` call but making the useEffect body bail out early.

Revised approach (hooks must not be conditional):
```ts
useEffect(() => {
  if (!fetchedAt) return;
  const id = setInterval(() => setNow(Date.now), 60_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') setNow(Date.now);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, [fetchedAt]);
```

Key change: add `fetchedAt` to the dependency array so the effect re-runs when data arrives, and return early inside the effect body when null.

---

## Fix 6 (NTH-1): Add zoom limit comment

**File:** `packages/server/src/routes/weather-tiles.ts` line 52

Add a comment on the line with `z > 7`:
```ts
      z < 0 || z > 7 || x < 0 || y < 0 || // RainViewer free tier: max zoom 7
```

---

## Verification

Run typecheck and tests after all changes:
```bash
npx turbo run typecheck
npx turbo run test
```
