# Weather & Air Quality Tile Refinements

## Changes

### 1. Default-expand on non-mobile
**File:** `Tile.tsx`
- Add `defaultExpanded?: boolean` prop
- Initialize state: `useState(defaultExpanded ?? false)`

**File:** `CommandLayout.tsx`
- Compute `isDesktop = window.matchMedia('(min-width: 640px)').matches` (safe — Vite SPA, no SSR)
- Pass `defaultExpanded={isDesktop}` to Weather and AQ `<Tile>`s

### 2. Weather tile layout
**File:** `WeatherStrip.tsx`

**Current conditions — restructure to 2-row grid:**
```
  7°       ☁️         ← row 1, vertically centered
Feels 4°  Overcast   ← row 2, vertically centered
```
Replace the two `text-center` columns with a 2×2 grid where each row is a flex row with `items-center justify-center`.

**Remove "Hourly" / "Daily" labels:** Delete the two `<h3>` elements.

**Hourly — max 7 entries with adaptive sampling:**
Progressive intervals by time-of-day bucket:
- 18:00–24:00 → every 1h (high detail for evening)
- 12:00–18:00 → every 2h
- 06:00–12:00 → every 3h
- 00:00–06:00 → every 4h
Filter future hourly entries, pick using bucket step, cap at 7.

**Daily — match hourly count:**
- `daily.slice(0, hourlyCount)` so both rows have the same number of entries.

### 3. Air quality — station measurements
**File:** `AirQualityStrip.tsx`

Add a new expanded section below the pollutant grid: 8 official station entries from `useAirQualityGrid()`, displayed in a 2-column grid (4 rows × 2 cols).

Each entry: station name (truncated) + AQI value with color dot.

Filter to WAQI stations only (those with `url` containing `aqicn.org`), pick 8 representative ones across the city (sort by name to give stable order, or just take first 8).
