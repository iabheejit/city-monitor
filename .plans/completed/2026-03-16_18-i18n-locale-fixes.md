# Plan 18: Fix hardcoded locales for Turkish and Arabic users

**Type:** bugfix
**Complexity:** simple
**Files affected:** 9 (5 components + 4 translation files)

## Problem

Three areas of the frontend use hardcoded `'de-DE'` or incomplete locale mappings, meaning Turkish (`tr`) and Arabic (`ar`) users see German-formatted dates/numbers instead of native formatting.

## Design Decision

**Use `i18n.language` directly as the Intl locale** (not a mapping table). The app's 4 supported languages (`de`, `en`, `tr`, `ar`) are all valid BCP 47 subtags that work with `Intl.DateTimeFormat` and `Intl.NumberFormat`. A mapping to full locales like `de-DE` is unnecessary since the app doesn't need region-specific formatting variants.

## Changes

### 1. CouncilMeetingsStrip.tsx

Lines 30 and 34 hardcode `'de-DE'` in `formatDayHeader` and `formatTime`.

- Destructure `i18n` from `useTranslation()` on line 109 (already has `t`)
- Add `locale: string` parameter to `formatDayHeader` (signature becomes `(isoDate, t, locale)`)
- Add `locale: string` parameter to `formatTime` (signature becomes `(isoDate, locale)`)
- Replace `'de-DE'` with `locale` in both functions
- Update call sites: line 158 passes `i18n.language`, line 68 passes `locale` (threaded through `MeetingRow` props or passed directly)

For `MeetingRow`: the simplest approach is to pass `locale` as an additional prop alongside `t`, since `formatTime` is called inside `MeetingRow` (line 68). Add `locale: string` to `MeetingRow`'s props.

### 2. FeuerwehrStrip.tsx

Lines 84, 85, 115, 116 use `.toLocaleString('de-DE')`.

- Line 68: change `const { t } = useTranslation()` to `const { t, i18n } = useTranslation()`
- Replace all 4 occurrences of `'de-DE'` with `i18n.language`

### 3. LaborMarketStrip.tsx

Lines 51, 69, 89 use `.toLocaleString('de-DE')`.

- Line 26: change `const { t } = useTranslation()` to `const { t, i18n } = useTranslation()`
- Replace all 3 occurrences of `'de-DE'` with `i18n.language`

### 4. WeatherStrip.tsx

Line 75: `const locale = i18n.language === 'de' ? 'de' : 'en'`

- Replace with `const locale = i18n.language`

### 5. WeatherPopover.tsx

Line 27: same ternary as WeatherStrip.

- Replace with `const locale = i18n.language`

Lines 164-165: hardcoded `'Heute'`/`'Today'` and `'Morgen'`/`'Tmrw'` strings in `formatDayName`.

- Add `t` parameter to `formatDayName` (signature becomes `(dateStr, locale, t)`)
- Replace hardcoded strings: `t('panel.weather.today')` and `t('panel.weather.tomorrow')`
- Update all 3 call sites (lines 117, 136, 140) to pass `t`
- These keys do NOT exist yet under `panel.weather` -- add them to all 4 translation files

### 6. Translation files (4 files)

Add `today` and `tomorrow` keys to `panel.weather` section in each file:

**en.json:** `"today": "Today", "tomorrow": "Tmrw"` (short form to match weekday abbreviations in the forecast row)
**de.json:** `"today": "Heute", "tomorrow": "Morgen"`
**tr.json:** `"today": "Bugün", "tomorrow": "Yarın"`
**ar.json:** `"today": "اليوم", "tomorrow": "غداً"`

Insert after the existing `"uvLevel"` block (around line 55 in en.json).

## Verification

1. `npx turbo run typecheck` -- all packages compile
2. `npx turbo run test` -- no regressions
3. Manual: switch language to TR/AR in the app and check that dates, numbers, and day names render in the selected language

## File list

1. `packages/web/src/components/strips/CouncilMeetingsStrip.tsx`
2. `packages/web/src/components/strips/FeuerwehrStrip.tsx`
3. `packages/web/src/components/strips/LaborMarketStrip.tsx`
4. `packages/web/src/components/strips/WeatherStrip.tsx`
5. `packages/web/src/components/layout/WeatherPopover.tsx`
6. `packages/web/src/i18n/en.json`
7. `packages/web/src/i18n/de.json`
8. `packages/web/src/i18n/tr.json`
9. `packages/web/src/i18n/ar.json`
