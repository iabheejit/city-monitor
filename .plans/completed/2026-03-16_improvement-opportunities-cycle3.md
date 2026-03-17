# Improvement Opportunities — Cycle 3
**Date:** 2026-03-16
**Scope:** Full codebase, focused on areas not yet addressed in cycles 1–2.
**Scoping decisions:** Skipped `.git/`, `node_modules/`, `dist/`, generated files. Examined all strip components, server routes/cron, shared types, i18n files, layout components, and hooks.

---

## Already Addressed (cycles 1–2, not re-reported)
See task prompt for the full exclusion list.

---

## Critical

*(No critical-severity findings. No unhandled data corruption, security vulnerabilities, or runtime crashes found in new code areas.)*

---

## Important

### IMP-1: `ConstructionSite` type imported from cron module in route file
**File:** `packages/server/src/routes/construction.ts:5`
**Issue:** `ConstructionSite` is imported from `../cron/ingest-construction.js` (a re-export) rather than directly from `@city-monitor/shared`. Every other route imports its types from `@city-monitor/shared` directly. The re-export pattern works today, but any future refactor of the cron module that removes or changes the re-export silently breaks the route's type contract without a compiler error.
**Fix:** Change line 5 to `import type { ConstructionSite } from '@city-monitor/shared';`.

### IMP-2: `PoliticalStrip` view-selector tabs lack keyboard navigation (`useTabKeys`)
**File:** `packages/web/src/components/strips/PoliticalStrip.tsx:198–212`
**Issue:** The three-way tab bar (State / Districts / Bundestag) is rendered with plain `<button>` elements but does not use `useTabKeys`, so Arrow keys, Home, and End do not work. All other multi-tab strips in the codebase (`EventsStrip`, `BudgetStrip`, `CrisisStrip`) correctly use `useTabKeys` and set `role="tablist"` / `role="tab"` / `aria-selected`. The political strip also does not set these ARIA roles.
**Fix:** Apply the same `useTabKeys` pattern used in `BudgetStrip` — add `role="tablist"`, `role="tab"`, `aria-selected`, `tabIndex` roving logic, and hook up `onKeyDown`.

### IMP-3: `CouncilMeetingsStrip.formatDayHeader` and `formatTime` always use `de-DE` locale, ignoring user language
**File:** `packages/web/src/components/strips/CouncilMeetingsStrip.tsx:30,34`
**Issue:** Both date formatters are hardcoded to `'de-DE'` regardless of the active i18n language. Users in EN/TR/AR will see German weekday and month names in the council meetings strip. This is inconsistent with `WeatherStrip` and `EventsStrip`, which correctly derive the locale from `i18n.language`.
**Fix:** Accept `locale` as a parameter (derived from `i18n.language` the same way `WeatherStrip` does at line 75) and thread it through `formatDayHeader` and `formatTime`.

### IMP-4: Missing route-level tests for `construction` and `noise-sensors`
**File:** No test files found at `packages/server/src/routes/construction.test.ts` or `packages/server/src/routes/noise-sensors.test.ts`
**Issue:** The glob search confirms these two routes are the only routes in the 25-route server package that have no corresponding `.test.ts` file. Every other route (including the recently-added `feuerwehr`, `pollen`, and `council-meetings`) has route tests. The construction and noise-sensor routes do have cron tests, but route behavior (cache hit, DB fallback, 404 on bad city) is untested.
**Fix:** Add route test files following the existing pattern (cache hit / DB fallback / city-not-found). The `council-meetings.test.ts` is a good template.

---

## Moderate

### MOD-1: `SafetyStrip` renders its own `<section>` wrapper with hardcoded `border-b` styling, breaking the `Tile` layout contract
**File:** `packages/web/src/components/strips/SafetyStrip.tsx:21`
**Issue:** `SafetyStrip` is the only strip component that wraps itself in a `<section className="border-b border-gray-200 ... px-4 py-4">` with its own `<h2>` title. All other strips are pure content — they rely on `Tile` to provide the card chrome, title bar, and padding. This creates double padding when `SafetyStrip` is placed inside a `Tile`, and the embedded `<h2>` duplicates the tile header. If the tile's padding class ever changes, `SafetyStrip` diverges silently.
**Fix:** Remove the `<section>` wrapper and `<h2>` from `SafetyStrip` — render only the grid of cards and the `TileFooter`, matching how every other strip works.

### MOD-2: `AppointmentsStrip` shows "+N more" using the transit translation key `panel.transit.more`
**File:** `packages/web/src/components/strips/AppointmentsStrip.tsx:139`
**Issue:** Line 139 uses `t('panel.transit.more')` for the "show more" button in the appointments strip. This is a copy-paste error — the appointments and transit strips share a translation string from a different domain. This means if `panel.transit.more` is ever reworded to be transit-specific (e.g., "more disruptions"), the appointments strip picks up that wording. There is already a `panel.events.showMore` pattern; appointments should have its own key.
**Fix:** Add `panel.appointments.more` to all four i18n JSON files (same value as `panel.transit.more` for now) and use that key on line 139.

### MOD-3: `WeatherStrip.isToday` logic uses a potentially incorrect comparison
**File:** `packages/web/src/components/strips/WeatherStrip.tsx:20–25`
**Issue:** `isToday` converts "now" to UTC-based date components and computes `todayUtc`, then checks `Math.abs(date.getTime() - todayUtc) < 86400_000`. This is functionally correct for filtering today's daily card, but the comparison is off-by-one-vulnerable — a date 23:59:59 earlier would pass. Idiomatic approach is to compare year/month/day strings directly (same pattern used in `CouncilMeetingsStrip`). Low risk, but inconsistent with the rest of the codebase.
**Fix:** Compare `dateStr` to `new Date().toISOString().slice(0, 10)` directly (UTC-based), removing the millisecond arithmetic.

### MOD-4: `BudgetStrip` `DistrictView` does not guard against same district selected on both sides
**File:** `packages/web/src/components/strips/BudgetStrip.tsx:315–333`
**Issue:** When a user selects the same district in both the left and right dropdown, two identical pie charts are shown side-by-side with no explanation. Unlike map tools that disallow equal selections, this just renders two identical charts silently. Confusing UX.
**Fix:** Show a visual hint (e.g., a short text "Select a different district to compare") or auto-advance the right side to the next district when both sides match.

### MOD-5: `PopulationStrip` donut chart slices computed inline inside JSX
**File:** `packages/web/src/components/strips/PopulationStrip.tsx:113–133`
**Issue:** The slice computation for the `AgeDonut` chart is done inside an IIFE directly in JSX (`{(() => { ... })()}`). This runs on every render and is harder to test in isolation. The `BudgetStrip` uses a proper `buildSlices` helper function. Consistency and memoization would improve maintainability.
**Fix:** Extract the slice builder to a `buildAgeSlices(data, t)` helper function, memoize the result with `useMemo`, and pass it to `<AgeDonut slices={…} />`.

### MOD-6: Hard-coded `'de-DE'` locale in `FeuerwehrStrip` and `LaborMarketStrip` number formatting
**Files:** `packages/web/src/components/strips/FeuerwehrStrip.tsx:85,94,98` (`.toLocaleString('de-DE')`), `packages/web/src/components/strips/LaborMarketStrip.tsx:51,69`
**Issue:** Number formatting uses the hardcoded locale `'de-DE'` even for non-German users, so EN/TR/AR users see German-style thousand separators (e.g., "123.456" instead of "123,456"). The pattern should either use `undefined` (user locale) or `i18n.language` like other components.
**Fix:** Replace `'de-DE'` with `undefined` in `.toLocaleString()` calls for mission counts and unemployed counts, or derive the locale from `i18n.language`.

### MOD-7: `emergencies.ts` map popup HTML uses hardcoded English strings ("Today", "Tomorrow", "Directions", "Indoor", "Outdoor")
**File:** `packages/web/src/components/map/layers/emergencies.ts:19–20, 95, 101, 137–140`
**Issue:** The pharmacy popup `formatPharmacyDuty` helper returns English strings "Today"/"Tomorrow" and the AED popup template contains "AED / Defibrillator", "Indoor", "Outdoor", "Access:", "Directions ↗". Map popups are not covered by i18n — they generate raw HTML strings outside React's translation context. This is a known limitation of MapLibre GL's popup API, but it means non-German/non-English users see English text in map popups.
**Fix (pragmatic):** Either (a) accept the limitation and document it in `.context/new-data-sources.md` as a known gap, or (b) inject translated strings at call time from a React layer that has access to `useTranslation`. Option (b) would require a different integration point.

### MOD-8: `AirQualityStrip` station name cleanup regex is overly narrow
**File:** `packages/web/src/components/strips/AirQualityStrip.tsx:169`
**Issue:** The station name is cleaned with two chained `.replace()` calls: first `, Berlin, Germany` then `, Germany`. If a Hamburg station ever gets included (which is possible since `useAirQualityGrid` does not filter by city), the `, Hamburg, Germany` suffix remains. A single regex would handle all German cities.
**Fix:** Replace with a single `.replace(/,\s+(?:\w+,\s+)?Germany$/, '')` or equivalent.

---

## Nice to Have

### N2H-1: `CouncilMeetingsStrip` default filter is `PARLIAMENT_KEY` regardless of city
**File:** `packages/web/src/components/strips/CouncilMeetingsStrip.tsx:111`
**Issue:** The default filter value is `'parliament'`, but the council meetings feature is Berlin-only. When Hamburg is enabled in the future and gets a different default, this hardcoded initial state will need updating. Additionally, if no parliament meetings exist (but BVV meetings do), the strip shows "No upcoming meetings" even though BVV meetings are present.
**Fix:** Initialize the filter to `'parliament'` only if parliament meetings exist, otherwise default to the first available district or a new `'all'` option.

### N2H-2: `Tile` expand/collapse aria-label uses hardcoded English "collapse" / "expand"
**File:** `packages/web/src/components/layout/Tile.tsx:80`
**Issue:** `aria-label={`${title} — ${expanded ? 'collapse' : 'expand'}`}` is not translatable. Screen reader users in TR or AR get English strings. The title is already translated (it comes from the `t()` call at the `CommandLayout` level), but "collapse" and "expand" are hardcoded.
**Fix:** Add `tile.expand` / `tile.collapse` keys to all i18n files and thread `t` into the Tile component, or accept a `expandLabel`/`collapseLabel` prop.

### N2H-3: `BriefingStrip` is not yet covered by a dedicated component test
**File:** `packages/web/src/components/strips/` — no `BriefingStrip.test.tsx`
**Issue:** `BriefingStrip` is the most prominently-placed tile (span=2, rowSpan=2) and integrates both the news summary and news digest hooks, tab navigation, and error fallbacks. It has test coverage for the `useNewsSummary` hook but no rendering test for the strip component itself.
**Fix:** Add a `BriefingStrip.test.tsx` covering: loading state, error fallback, summary present, headline tab switching.

### N2H-4: `WeatherStrip.formatDayName` locale handling only maps `de` → `de`, all other languages fall back to `en`
**File:** `packages/web/src/components/strips/WeatherStrip.tsx:75`
**Issue:** `const locale = i18n.language === 'de' ? 'de' : 'en'` means Turkish and Arabic users get English day names ("Mon", "Tue") in the weather tile instead of native day names. `tr` and `ar` are both valid `Intl` locales for `toLocaleDateString`.
**Fix:** Map all four supported languages: `'de' → 'de'`, `'tr' → 'tr'`, `'ar' → 'ar'`, default `'en'`. Same fix applies to `WeatherPopover.tsx:27` which has the identical pattern.

### N2H-5: Inline SVG in `CommandLayout` support tile is not aria-hidden
**File:** `packages/web/src/components/layout/CommandLayout.tsx:129–131`
**Issue:** The heart SVG icon in the support tile has `aria-hidden="true"` already — this one is fine. However, the inline SVG chevron in `Tile.tsx:85–99` also has `aria-hidden="true"` — also fine. No action needed. *(Confirmed correct on review.)*

### N2H-6: `EventsStrip` key uses both `event.id` and array index: `${event.id}-${i}`
**File:** `packages/web/src/components/strips/EventsStrip.tsx:263`
**Issue:** Using `key={\`${event.id}-${i}\`}` defeats the purpose of stable keys — if events are reordered or filtered, React can't reuse DOM nodes. This likely exists because event IDs from different sources may collide. A better approach is `key={\`${event.source}-${event.id}\`}` which produces globally unique stable keys.
**Fix:** Change to `key={\`${event.source}-${event.id}\`}`.

### N2H-7: `useFreshness` interval does not account for hook being called during inactive tab
**File:** `packages/web/src/hooks/useFreshness.ts:18–20`
**Issue:** The `setInterval` runs every 60s regardless of tab visibility. On returning to a tab after a long absence, the "updated X min ago" text may be stale for up to 60 seconds before the interval fires. Low impact, but a `visibilitychange` listener or `document.addEventListener('visibilitychange')` reset would make the stale indicator immediately correct on tab focus.
**Fix:** Add a `visibilitychange` event listener that calls `setNow(Date.now)` immediately when the tab becomes visible again.

### N2H-8: `CrisisStrip` "show more" button missing `type="button"`
**File:** `packages/web/src/components/strips/CrisisStrip.tsx:128`
**Issue:** The `<button>` for "show more" on line 128 is missing `type="button"`. All other show-more buttons in the codebase (e.g., `AppointmentsStrip`, `TransitStrip`) include `type="button"`. While the strip is not inside a form so this is low-risk, it is inconsistent.
**Fix:** Add `type="button"` to the button element.

### N2H-9: `formatAmount` in `BudgetStrip` uses English abbreviations (`bn`, `M`, `K`) regardless of locale
**File:** `packages/web/src/components/strips/BudgetStrip.tsx:31–36`
**Issue:** `formatAmount` returns English abbreviations like "1.2 bn" and "45 M" for all languages. German uses "Mrd." and "Mio."; Turkish uses "Mr." and "M." A locale-aware formatter using `Intl.NumberFormat` with `notation: 'compact'` would handle this automatically.
**Fix:** Replace with `new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(amount)` using a locale derived from `i18n.language`. This also removes the manual range checks.

### N2H-10: `LaborMarketStrip` renders `null` for Hamburg but is unconditionally placed in `CommandLayout`
**File:** `packages/web/src/components/layout/CommandLayout.tsx:169–173`
**Issue:** The labor market tile is wrapped in `{cityId === 'berlin' && ...}` at the `CommandLayout` level, but `LaborMarketStrip` *also* contains its own `if (!isBerlin) return null` guard internally (line 29). This double-guarding is redundant and inconsistent with `WastewaterStrip` and `PopulationStrip` which also self-guard but *are* wrapped in the same outer `cityId === 'berlin'` check. A future developer may add Hamburg labor market data and be confused why neither removing the outer guard nor the inner guard alone is sufficient.
**Fix:** Remove the inner `if (!isBerlin) return null` guards from `LaborMarketStrip`, `WastewaterStrip`, and `PopulationStrip` since the outer `CommandLayout` already gates them. The component should either be city-agnostic (render for any city with data) or self-contained — not both.

---

## Summary Table

| ID | Severity | File(s) | One-line description |
|----|----------|---------|----------------------|
| IMP-1 | Important | `routes/construction.ts` | `ConstructionSite` imported from cron re-export instead of `@city-monitor/shared` |
| IMP-2 | Important | `strips/PoliticalStrip.tsx` | View-selector tabs missing `useTabKeys`, `role="tablist"`, and ARIA attributes |
| IMP-3 | Important | `strips/CouncilMeetingsStrip.tsx` | Date formatters hardcoded to `de-DE`, ignoring user language |
| IMP-4 | Important | (missing files) | No route tests for `construction` and `noise-sensors` routes |
| MOD-1 | Moderate | `strips/SafetyStrip.tsx` | Strip renders own `<section>` wrapper breaking Tile layout contract |
| MOD-2 | Moderate | `strips/AppointmentsStrip.tsx` | "Show more" button uses wrong translation key (`panel.transit.more`) |
| MOD-3 | Moderate | `strips/WeatherStrip.tsx` | `isToday` uses fragile millisecond-range comparison instead of date string |
| MOD-4 | Moderate | `strips/BudgetStrip.tsx` | Same district on both sides of comparison renders two identical charts silently |
| MOD-5 | Moderate | `strips/PopulationStrip.tsx` | Donut chart slice computation is an inline IIFE, not memoized |
| MOD-6 | Moderate | `FeuerwehrStrip.tsx`, `LaborMarketStrip.tsx` | Number formatting hardcoded to `de-DE` locale |
| MOD-7 | Moderate | `map/layers/emergencies.ts` | Map popup HTML contains hardcoded English strings |
| MOD-8 | Moderate | `strips/AirQualityStrip.tsx` | Station name cleanup regex doesn't handle non-Berlin German cities |
| N2H-1 | Nice to have | `strips/CouncilMeetingsStrip.tsx` | Default filter shows empty state when parliament has no meetings but BVV does |
| N2H-2 | Nice to have | `layout/Tile.tsx` | `aria-label` expand/collapse text is hardcoded English |
| N2H-3 | Nice to have | (missing) | No rendering test for `BriefingStrip` component |
| N2H-4 | Nice to have | `strips/WeatherStrip.tsx`, `layout/WeatherPopover.tsx` | Locale mapping only handles `de`, all others fall back to `en` |
| N2H-6 | Nice to have | `strips/EventsStrip.tsx` | Event key uses `id + index` instead of stable `source + id` |
| N2H-7 | Nice to have | `hooks/useFreshness.ts` | Freshness interval doesn't reset on tab visibility change |
| N2H-8 | Nice to have | `strips/CrisisStrip.tsx` | "Show more" button missing `type="button"` |
| N2H-9 | Nice to have | `strips/BudgetStrip.tsx` | `formatAmount` uses hardcoded English abbreviations (`bn`, `M`, `K`) |
| N2H-10 | Nice to have | `CommandLayout.tsx` + multiple strips | Berlin-only strips double-guarded (outer AND inner city check) |
