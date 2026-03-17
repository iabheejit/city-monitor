# Plan 21: Miscellaneous Frontend Fixes

**Type:** refactor
**Complexity:** simple
**Date:** 2026-03-16

## Overview

Five small frontend improvements: strip chrome cleanup, donut chart extraction, i18n for expand/collapse, visibility-aware freshness hook, and removal of redundant Berlin guards.

## Changes

### MOD-1: SafetyStrip -- Remove self-contained section wrapper

**File:** `packages/web/src/components/strips/SafetyStrip.tsx`

Remove the outer `<section className="border-b ...">` wrapper and embedded `<h2>` title (lines 21-24, 69). The component should return only its content, wrapped in a Fragment:

- Replace `<section className="border-b border-gray-200 dark:border-gray-800 px-4 py-4">` + `<h2>` with `<>`.
- Replace closing `</section>` with `</>`.
- Remove the `<h2>` title block (lines 22-24) entirely -- the parent `Tile` provides the title chrome.

Note: SafetyStrip is currently not imported anywhere in the codebase (orphaned component). The structural fix is still correct -- when it gets wired back in, it should match the other strips' pattern.

### MOD-5: PopulationStrip -- Extract donut slice computation

**File:** `packages/web/src/components/strips/PopulationStrip.tsx`

Extract the inline IIFE (lines 113-133) into a `useMemo`-based helper:

1. Add `useMemo` to the React import.
2. Before the return statement, add:
   ```ts
   const ageSlices = useMemo(() => {
     const segments = [
       { key: 'youth' as const, pct: data.youthPct },
       { key: 'workingAge' as const, pct: data.workingAgePct },
       { key: 'elderly' as const, pct: data.elderlyPct },
     ];
     const result: DonutSlice[] = [];
     let angle = -Math.PI / 2;
     for (const seg of segments) {
       const sweep = (seg.pct / 100) * Math.PI * 2;
       result.push({
         startAngle: angle,
         endAngle: angle + sweep,
         color: SEGMENT_COLORS[seg.key],
         label: t(`panel.population.${seg.key}`),
         pct: seg.pct,
       });
       angle += sweep;
     }
     return result;
   }, [data.youthPct, data.workingAgePct, data.elderlyPct, t]);
   ```
3. Replace the IIFE prop with `slices={ageSlices}`.

### N2H-2: Tile.tsx -- i18n for expand/collapse aria-label

**Files:**
- `packages/web/src/components/layout/Tile.tsx`
- `packages/web/src/i18n/en.json`
- `packages/web/src/i18n/de.json`
- `packages/web/src/i18n/tr.json`
- `packages/web/src/i18n/ar.json`

1. In Tile.tsx, add `useTranslation` import and call `const { t } = useTranslation();` inside the component.
2. Change the `aria-label` on line 80 from:
   ```
   `${title} — ${expanded ? 'collapse' : 'expand'}`
   ```
   to:
   ```
   `${title} — ${expanded ? t('tile.collapse') : t('tile.expand')}`
   ```
3. Add `tile.expand` and `tile.collapse` keys to all 4 locale files:
   - EN: `"tile": { "expand": "expand", "collapse": "collapse" }`
   - DE: `"tile": { "expand": "aufklappen", "collapse": "zuklappen" }`
   - TR: `"tile": { "expand": "genislet", "collapse": "daralt" }`
   - AR: `"tile": { "expand": "توسيع", "collapse": "طي" }`

### N2H-7: useFreshness -- visibilitychange listener

**File:** `packages/web/src/hooks/useFreshness.ts`

Add a `visibilitychange` event listener inside the existing `useEffect` that immediately updates `now` when the tab becomes visible:

```ts
useEffect(() => {
  const id = setInterval(() => setNow(Date.now), 60_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') setNow(Date.now);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, []);
```

This ensures that when a user switches back to the tab after a long absence, the "ago" text updates immediately instead of waiting up to 60 seconds.

### N2H-10: Remove redundant `if (!isBerlin) return null` guards

**Files:**
- `packages/web/src/components/strips/LaborMarketStrip.tsx`
- `packages/web/src/components/strips/WastewaterStrip.tsx`
- `packages/web/src/components/strips/PopulationStrip.tsx`

In each file:
1. Remove the `const isBerlin = cityId === 'berlin';` variable.
2. Remove the `if (!isBerlin) return null;` guard.
3. In LaborMarketStrip and WastewaterStrip, the `isBerlin` was also passed as the `enabled` parameter to the data hook (`useLaborMarket(cityId, isBerlin)` and `useWastewater(cityId, isBerlin)`). Since `CommandLayout` already gates rendering with `cityId === 'berlin'`, these will always be called with `cityId === 'berlin'`, so replace `isBerlin` with `true` (or simply omit the second argument if the default is `true`).

Checking the hook signatures:
- `useLaborMarket(cityId: string, enabled = true)` -- default is `true`, so just pass `cityId`.
- `useWastewater(cityId: string, enabled = true)` -- same, just pass `cityId`.

## Files Affected (10)

1. `packages/web/src/components/strips/SafetyStrip.tsx`
2. `packages/web/src/components/strips/PopulationStrip.tsx`
3. `packages/web/src/components/layout/Tile.tsx`
4. `packages/web/src/hooks/useFreshness.ts`
5. `packages/web/src/components/strips/LaborMarketStrip.tsx`
6. `packages/web/src/components/strips/WastewaterStrip.tsx`
7. `packages/web/src/i18n/en.json`
8. `packages/web/src/i18n/de.json`
9. `packages/web/src/i18n/tr.json`
10. `packages/web/src/i18n/ar.json`

## Testing

- Run `npx turbo run typecheck` to verify no type errors.
- Run `npx turbo run test` to verify existing tests pass.
- No new test files needed -- these are straightforward refactors. The useFreshness hook's visibilitychange behavior could be tested but is simple enough to verify by inspection and manual testing.

## Self-Review

- MOD-1: Straightforward wrapper removal. SafetyStrip is currently orphaned but the fix is correct for when it gets re-integrated.
- MOD-5: `useMemo` is the right approach -- the slice computation depends on data values and the `t` function, both of which are stable across renders when data hasn't changed.
- N2H-2: Adding `useTranslation` to Tile is fine -- it's a leaf component and the hook is lightweight.
- N2H-7: Combining the interval and visibilitychange listener in one effect is clean. Using `Date.now` (without calling it as `Date.now()`) matches the existing `useState(Date.now)` pattern already used in the file.
- N2H-10: The guards are provably redundant because `CommandLayout` wraps all three in `{cityId === 'berlin' && (...)}`. Removing them simplifies the components and removes dead code paths.
