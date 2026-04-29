# Plan 24: Frontend Refactors (Mixed)

**Type:** refactor
**Complexity:** simple
**Files affected:** 5 modified, 1 new

---

## MOD-4: Memoize `sampleHourly` in WeatherStrip

**File:** `packages/web/src/components/strips/WeatherStrip.tsx`

**Problem:** `sampleHourly()` runs on every render even when `hourly` data hasn't changed. It filters, iterates, and creates Date objects -- unnecessary work when the parent re-renders without new weather data.

**Change:**
1. Add `useMemo` to the existing React import (line 1 -- CrisisStrip already imports it but WeatherStrip does not).
2. Wrap the `sampleHourly` call (line 78) in `useMemo`:

```ts
const sampledHourly = useMemo(() => {
  const nowStr = new Date().toISOString().slice(0, 16);
  return sampleHourly(hourly, nowStr);
}, [hourly]);
```

Move `nowStr` inside the memo so it captures a fresh timestamp when `hourly` changes but doesn't cause extra dependency churn. The dependency is `[hourly]` -- `hourly` is derived from `data?.hourly` which only changes on a new fetch.

---

## MOD-5: Extract shared `formatDelta` and `formatTime` into `format-stats.ts`

**Problem:** `FeuerwehrStrip` defines `formatDelta` (percentage delta with color) and `formatTime` (seconds to mm:ss). `LaborMarketStrip` has `formatYoy` which is a simplified version of `formatDelta` (always treats positive as bad, no `invert` param, no `previous` guard). Extracting avoids duplication and enables reuse.

### New file: `packages/web/src/lib/format-stats.ts`

Export two functions:

```ts
/**
 * Format seconds as mm:ss (e.g. 452 -> "7:32").
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Percentage delta with Tailwind color classes.
 * @param current  - current value
 * @param previous - previous value (returns null if undefined or 0)
 * @param invert   - if true, negative change is "worse" (default: positive is worse)
 */
export function formatDelta(
  current: number,
  previous: number | undefined,
  invert = false,
): { text: string; color: string } | null {
  if (previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  const value = Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  const isWorse = invert ? pct < 0 : pct > 0;
  const color = isWorse
    ? 'text-red-500 dark:text-red-400'
    : pct === 0
      ? 'text-gray-400'
      : 'text-green-500 dark:text-green-400';
  return { text: `${sign}${value}%`, color };
}

/**
 * Year-over-year percentage with Tailwind color classes.
 * Simplified version of formatDelta for pre-computed YoY percentages
 * where positive = worse (higher unemployment).
 */
export function formatYoy(percent: number): { text: string; color: string } {
  const sign = percent > 0 ? '+' : '';
  const value = Number.isInteger(percent) ? percent : percent.toFixed(1);
  const color = percent > 0
    ? 'text-red-500 dark:text-red-400'
    : percent < 0
      ? 'text-green-500 dark:text-green-400'
      : 'text-gray-400';
  return { text: `${sign}${value}%`, color };
}
```

**Decision -- keep `formatYoy` separate rather than unifying with `formatDelta`:**
`formatYoy` takes a pre-computed percentage directly, while `formatDelta` takes two raw values and computes the percentage. They have different signatures and semantics. Forcing `LaborMarketStrip` to use `formatDelta` would require inventing a fake `previous` value (e.g. `formatDelta(rate, rate / (1 + yoy/100))`), which is worse than a clean dedicated function. So we extract all three functions into the shared module.

### Update `FeuerwehrStrip.tsx`

- Remove the local `formatTime` and `formatDelta` function definitions (lines 9-27).
- Add import: `import { formatDelta, formatTime } from '../../lib/format-stats.js';`

### Update `LaborMarketStrip.tsx`

- Remove the local `formatYoy` function definition (lines 9-18).
- Add import: `import { formatYoy } from '../../lib/format-stats.js';`

---

## NTH-3: Staleness warning for hardcoded Bezirksbuergermeister data

**File:** `packages/server/src/cron/ingest-political.ts`

**Change:** Add a `LAST_VERIFIED` date constant near the existing comment (line 22) and a startup check function.

```ts
/** Date the BEZIRKSBUERGERMEISTER data was last manually verified. */
const BEZIRKSBUERGERMEISTER_LAST_VERIFIED = new Date('2026-03-02');
const STALENESS_THRESHOLD_DAYS = 180;
```

In `preCacheBezirke()` (which runs at server startup), add after the for-loop:

```ts
const ageMs = Date.now() - BEZIRKSBUERGERMEISTER_LAST_VERIFIED.getTime();
const ageDays = Math.round(ageMs / 86_400_000);
if (ageDays > STALENESS_THRESHOLD_DAYS) {
  log.warn(
    `Bezirksbuergermeister data was last verified ${ageDays} days ago (${BEZIRKSBUERGERMEISTER_LAST_VERIFIED.toISOString().slice(0, 10)}). ` +
    `Please re-verify at https://berlin.de/rbmskzl/regierender-buergermeister/buergermeister-von-berlin/rat-der-buergermeister/`
  );
}
```

This logs once at startup, not on every cron run.

---

## NTH-4: Document CrisisStrip as Berlin-only

**File:** `packages/web/src/components/strips/CrisisStrip.tsx`

**Change:** Add a JSDoc comment above the component export (before line 62):

```ts
/**
 * Berlin-only crisis hotline directory.
 *
 * All phone numbers and Krisendienst regions are specific to Berlin.
 * This strip should only be mounted for Berlin cities (cityId === 'berlin').
 * If expanding to other cities, the service list and region data must be
 * replaced with city-specific equivalents.
 */
```

---

## File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `packages/web/src/lib/format-stats.ts` | **Create** -- shared `formatDelta`, `formatTime`, `formatYoy` |
| 2 | `packages/web/src/components/strips/WeatherStrip.tsx` | **Edit** -- add `useMemo` import, wrap `sampleHourly` |
| 3 | `packages/web/src/components/strips/FeuerwehrStrip.tsx` | **Edit** -- remove local functions, import from `format-stats` |
| 4 | `packages/web/src/components/strips/LaborMarketStrip.tsx` | **Edit** -- remove local `formatYoy`, import from `format-stats` |
| 5 | `packages/server/src/cron/ingest-political.ts` | **Edit** -- add `LAST_VERIFIED` constant + startup warning |
| 6 | `packages/web/src/components/strips/CrisisStrip.tsx` | **Edit** -- add Berlin-only JSDoc comment |

## Implementation Order

1. Create `format-stats.ts` (no dependencies)
2. Update `FeuerwehrStrip.tsx` and `LaborMarketStrip.tsx` (depend on step 1)
3. Update `WeatherStrip.tsx` (independent)
4. Update `ingest-political.ts` (independent)
5. Update `CrisisStrip.tsx` (independent)
6. Run typecheck: `npx turbo run typecheck`
