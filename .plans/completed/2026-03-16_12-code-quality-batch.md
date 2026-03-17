# Plan 12: Code Quality Batch (3 small refactors)

**Type:** refactor
**Complexity:** simple
**Files affected:** 3

---

## M4: Extract `stripBareCityLabel` helper in openai.ts

**File:** `packages/server/src/lib/openai.ts`

The identical 6-line city-label stripping block appears at lines 250-256 and 342-348. Extract into a private helper function.

### Changes

1. Add a new function near the top of the file (after imports/constants, before the exported functions):

```ts
/** Discard bare city-name labels that would resolve to city center. */
function stripBareCityLabel(label: string | null | undefined, cityLower: string): string | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase().trim();
  if (lower === cityLower || lower.startsWith(cityLower + ',') || lower.startsWith(cityLower + ' (')) {
    return undefined;
  }
  return label;
}
```

2. Replace lines 250-256 (in `filterHeadlines`) with:
```ts
const label = stripBareCityLabel(item.locationLabel, cityLower);
```

3. Replace lines 342-348 (in `geolocateReports`) with:
```ts
const label = stripBareCityLabel(item.locationLabel, cityLower);
```

Both call sites already have `cityLower` defined as `cityName.toLowerCase()`.

---

## M7: Remove redundant `displayItems` in NewsStrip.tsx

**File:** `packages/web/src/components/strips/NewsStrip.tsx`

`filteredItems` is already `.slice(0, MAX_ITEMS)` (line 81-82). Line 101 then does `filteredItems.slice(0, MAX_ITEMS)` again into `displayItems`. This is redundant.

### Changes

1. Delete line 101: `const displayItems = filteredItems.slice(0, MAX_ITEMS);`
2. Replace all references to `displayItems` (lines 130, 134) with `filteredItems`.

---

## M5: Increase headline hash window in summarize.ts

**File:** `packages/server/src/cron/summarize.ts`

The headline hash uses the top 5 headlines to detect changes. With 25 input headlines, 5 is too small a window -- if a single story rotates in/out of the top 5, the hash changes and triggers an unnecessary re-summarisation even though the overall set barely changed. Increasing to 10 and extracting as a named constant improves stability.

### Changes

1. Add named constant near existing constants (after line 25):
```ts
const HASH_HEADLINE_COUNT = 10;
```

2. Replace line 64 `.slice(0, 5)` with `.slice(0, HASH_HEADLINE_COUNT)`.

3. Update the comment on line 62 from "top-5" to reference the constant name.
