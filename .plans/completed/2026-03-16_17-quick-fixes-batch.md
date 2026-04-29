# Plan 17: Quick Fixes Batch (6 targeted fixes)

**Type:** bugfix/refactor mix
**Complexity:** simple
**Files affected:** 8 (6 component/route files + 4 i18n JSON files, but 2 overlap)

---

## Fixes

### IMP-1: Move ConstructionSite import to shared package

**File:** `packages/server/src/routes/construction.ts`
**Line 5:** Change `import type { ConstructionSite } from '../cron/ingest-construction.js'` to `import type { ConstructionSite } from '@city-monitor/shared'`.

The type is already defined in `shared/types.ts` (line 220). The cron file itself imports from shared and re-exports -- the route should import from the canonical source directly.

---

### MOD-2: Fix wrong i18n key in AppointmentsStrip "show more" button

**File:** `packages/web/src/components/strips/AppointmentsStrip.tsx`
**Line 138:** Change `t('panel.transit.more')` to `t('panel.appointments.more')`.

**i18n files** (4 files): Add `"more"` key inside the `"appointments"` object in each translation file:
- `en.json`: `"more": "more"` (matches transit.more value)
- `de.json`: `"more": "weitere"` (matches transit.more value)
- `tr.json`: `"more": "daha fazla"` (matches transit.more value)
- `ar.json`: `"more": "المزيد"` (matches transit.more value)

Insert after the last key in the `"service"` sub-object closing brace, so after line ~153 in en.json (before the closing `}` of appointments). The values are identical to `panel.transit.more` -- this is about semantic correctness so each domain owns its own key.

---

### MOD-3: Simplify isToday check in WeatherStrip

**File:** `packages/web/src/components/strips/WeatherStrip.tsx`
**Lines 20-25:** Replace the millisecond-arithmetic `isToday` function with a simple string comparison:

```ts
function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}
```

The `dateStr` parameter is already an ISO date string (YYYY-MM-DD format) from the weather API daily data. Comparing against `new Date().toISOString().slice(0, 10)` gives the current UTC date, which is the correct comparison since weather dates are UTC. This is functionally equivalent but much clearer.

---

### MOD-8: Generalize station name cleanup regex in AirQualityStrip

**File:** `packages/web/src/components/strips/AirQualityStrip.tsx`
**Line 169:** Replace the chained `.replace(/, Berlin, Germany$/, '').replace(/, Germany$/, '')` with a single `.replace(/,\s+(?:\w+,\s+)?Germany$/, '')`.

This handles station names like "StationName, Berlin, Germany", "StationName, Hamburg, Germany", and "StationName, Germany" all in one regex. The `(?:\w+,\s+)?` optionally matches any city name before "Germany".

---

### N2H-6: Use stable keys in EventsStrip

**File:** `packages/web/src/components/strips/EventsStrip.tsx`
**Line 263:** Change `key={`${event.id}-${i}`}` to `key={`${event.source}-${event.id}`}`.

Event IDs are unique within a source but could theoretically collide across sources (kulturdaten vs ticketmaster vs gomus). Using `source-id` is both stable (no index) and unique. The `CityEvent` type has both `source` and `id` fields.

---

### N2H-8: Add type="button" to CrisisStrip show-more button

**File:** `packages/web/src/components/strips/CrisisStrip.tsx`
**Line 127-132:** Add `type="button"` attribute to the show-more `<button>`. Without it, buttons default to `type="submit"` which could cause unexpected form submission if ever wrapped in a form.

---

## Implementation Order

All 6 fixes are independent. They can be done in any order. A single commit with message like "Fix 6 small issues (imports, i18n, regex, keys, a11y)" is appropriate.

## Testing

- Typecheck: `npm run typecheck` must pass (especially IMP-1 import change).
- No unit tests need modification; none of these files have co-located tests.
- Visual verification of AppointmentsStrip "show more" text, AirQualityStrip station names, and CrisisStrip button behavior is sufficient.
