# Plan 30: Frontend Code Quality Bundle

**Type:** refactor
**Complexity:** simple
**Files affected:** 7

## Overview

Four small frontend quality improvements: extract shared `formatDayName`, add a logger wrapper, extract shared district paint constants, and audit for hardcoded `'de-DE'` locale patterns.

---

## Item 1: Extract shared `formatDayName`

### Current State

- `WeatherStrip.tsx:12` has `formatDayName(dateStr, locale)` -- returns short weekday name.
- `WeatherPopover.tsx:157` has `formatDayName(dateStr, locale, t)` -- returns "Today"/"Tomorrow" for near days, otherwise short weekday name.

The popover version is a superset of the strip version. The strip version is equivalent to the popover version without the today/tomorrow logic.

### Plan

1. Create `packages/web/src/lib/format-day-name.ts` with a single exported function:
   ```ts
   export function formatDayName(
     dateStr: string,
     locale: string,
     todayLabel?: string,
     tomorrowLabel?: string,
   ): string
   ```
   - When `todayLabel`/`tomorrowLabel` are provided, check if the date matches and return the label.
   - Otherwise, return `date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })`.
   - Wrap in try/catch, fallback to `dateStr`.

2. Update `WeatherStrip.tsx` -- import and call `formatDayName(d.date, locale)` (no labels).

3. Update `WeatherPopover.tsx` -- import and call `formatDayName(d.date, locale, t('panel.weather.today'), t('panel.weather.tomorrow'))`.

4. Remove the local `formatDayName` definitions from both files.

**Design choice:** Using optional string parameters (`todayLabel`, `tomorrowLabel`) instead of passing the `t` function. This keeps the utility i18n-agnostic -- callers resolve translations before calling. Alternative was passing `t` directly, but that couples a date utility to i18next. Another alternative was two separate functions (`formatDayName` + `formatDayNameWithLabels`), but optional params are cleaner.

### Tests

Add `packages/web/src/lib/format-day-name.test.ts`:
- Returns short weekday for a known date.
- Returns `todayLabel` when date is today.
- Returns `tomorrowLabel` when date is tomorrow.
- Returns `dateStr` on invalid input.

---

## Item 2: Frontend logger wrapper

### Current State

No `console.*` calls exist in `packages/web/src`. The suggestion from Plan 01's follow-up was forward-looking: create the wrapper so future code uses it instead of raw console calls.

### Plan

Create `packages/web/src/lib/logger.ts`:

```ts
/** Thin logger wrapper for future error-tracking integration. */
const logger = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export default logger;
```

No callers to update since there are no existing `console.*` calls in the web source. The logger exists as infrastructure for future use.

**Design choice:** Default export as a singleton object. Alternative was a class or named export. A plain object is the simplest possible API and matches the `console` interface shape. No need for log levels, formatting, or conditional suppression yet.

No tests needed -- the wrapper is trivially delegating to console.

---

## Item 3: Extract shared district paint constants

### Current State

`political.ts` has identical paint values in `addDistrictLayer` (line 56-103) and `addDistrictSource` (line 119-154):

- **Line color:** `isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'`
- **Line width:** `1.5`
- **Line dasharray:** `[4, 2]`
- **Label text-color:** `isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.7)'`
- **Label halo-color:** `isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)'`
- **Label halo-width:** `1.5`
- **Fill color:** `isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'`

Also used in `applyPoliticalStyling` (line 179) and `resetDistrictStyling` (line 188-198).

### Plan

1. Add a helper function at the top of `political.ts`:

   ```ts
   function districtPaint(isDark: boolean) {
     return {
       fillColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
       lineColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)',
       lineWidth: 1.5 as const,
       lineDash: [4, 2] as const,
       textColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.7)',
       textHaloColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
       textHaloWidth: 1.5,
     };
   }
   ```

2. Replace all inline paint values in `addDistrictLayer`, `addDistrictSource`, `applyPoliticalStyling`, and `resetDistrictStyling` with references to `districtPaint(isDark)`.

**Design choice:** A function (not constants) because values depend on `isDark`. Kept it file-private since only `political.ts` uses these values. Alternative was exporting from `constants.ts`, but the values are only used in this one file.

No tests needed -- visual paint constants, verified by existing functionality.

---

## Item 4: Audit for hardcoded `'de-DE'` locale patterns

### Current State

Grep for `de-DE` across the web package returned **zero matches**. This was already addressed in Plan 18 (i18n locale fixes).

Grep for `'de'` only shows legitimate uses:
- `i18n/index.ts:20` -- `supportedLngs: ['de', 'en', 'tr', 'ar']`
- `config/cities/hamburg.ts:10` -- `languages: ['de', 'en']`
- `config/cities/berlin.ts:10` -- `languages: ['de', 'en', 'tr', 'ar']`

All `toLocaleString`/`toLocaleDateString` calls use either `i18n.language`, `locale` (from `useTranslation`), or `undefined` (browser default). No hardcoded German locale patterns remain.

### Plan

**No changes needed.** The audit is complete and the codebase is clean.

---

## Implementation Order

1. Item 3 (district paint constants) -- self-contained, single file
2. Item 1 (formatDayName extraction) -- new file + 2 consumer updates
3. Item 2 (logger wrapper) -- new file, no consumers to update
4. Item 4 -- no changes

## Files Changed

| File | Change |
|------|--------|
| `packages/web/src/lib/format-day-name.ts` | **New** -- shared formatDayName utility |
| `packages/web/src/lib/format-day-name.test.ts` | **New** -- tests |
| `packages/web/src/components/strips/WeatherStrip.tsx` | Remove local formatDayName, import shared |
| `packages/web/src/components/layout/WeatherPopover.tsx` | Remove local formatDayName, import shared |
| `packages/web/src/lib/logger.ts` | **New** -- thin console wrapper |
| `packages/web/src/components/map/layers/political.ts` | Extract `districtPaint()` helper, use in 4 functions |
