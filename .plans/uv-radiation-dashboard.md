# UV Radiation Levels — Research & Plan

## Data Source: Open-Meteo (recommended)

The project already calls `api.open-meteo.com/v1/forecast` every 30 min in `ingest-weather.ts`. UV index parameters are available on the **same endpoint** — just append them to the existing query strings:

| Scope | Parameters to add | Description |
|-------|------------------|-------------|
| `current` | `uv_index` | Current UV index (cloud-adjusted) |
| `hourly` | `uv_index` | Hourly UV forecast |
| `daily` | `uv_index_max` | Daily max UV index |

Open-Meteo also offers `uv_index_clear_sky` variants (worst-case without clouds), but the standard cloud-adjusted values are more useful for a dashboard.

**No new API key, no new dependency, no rate limit change.** Just 3 extra fields on the existing request.

### UV Index Scale (WHO standard)

| Value | Level | Color |
|-------|-------|-------|
| 0–2 | Low | Green |
| 3–5 | Moderate | Yellow |
| 6–7 | High | Orange |
| 8–10 | Very High | Red |
| 11+ | Extreme | Purple |

### Alternative sources considered

- **DWD `uvi.json`** — official German forecast, 3-day daily, Berlin & Hamburg included. Simple JSON, no auth. Could supplement Open-Meteo but is less granular (daily only, updated once at 07:30 UTC).
- **BfS measurement network** — actual measured UV via WFS, but no station in Berlin/Hamburg proper (nearest 50–80 km away). Not practical for city-level dashboard.
- **OpenUV.io** — 50 req/day free tier, insufficient for 2 cities × 48 daily polls.
- **CurrentUVIndex.com** — same NOAA data as Open-Meteo, redundant.

## Implementation Plan

### Server changes (minimal)

1. **`ingest-weather.ts`** (line 58–64) — add `uv_index` to `&current=`, `&hourly=`, and `uv_index_max` to `&daily=` query params. Extend `OpenMeteoResponse` interface. Add `uvIndex` field in `transformWeatherData()`.

2. **`shared/types.ts`** — add `uvIndex?: number` to `CurrentWeather`, `HourlyForecast`, and `DailyForecast`. Optional fields so existing cached/stored data doesn't break.

3. **No DB schema change needed** — `current`, `hourly`, `daily` are JSONB columns; new fields persist automatically.

### Dashboard tile

UV data naturally fits inside the existing **WeatherStrip** tile rather than a separate tile:

- **Collapsed view**: Add a UV index badge next to humidity/wind (e.g., "UV 3 ●" with WHO color)
- **Expanded view**: Show UV in the hourly forecast row and daily max UV in the 7-day forecast
- Add a small UV index color legend or tooltip explaining the scale

### Map layer

Open-Meteo does **not** provide UV raster tiles (unlike RainViewer for rain). Options for a map visualization:

#### Option A: UV sub-layer under Weather (recommended)
Add a `WeatherSubLayer` type with `'rain-radar' | 'uv-index'` sub-layers, similar to how traffic/water have sub-layers. The UV sub-layer would show:
- A **colored circle marker** at the city center point, sized and colored by current UV index (WHO color scale)
- When hovering/clicking: popup with current UV, today's max, and the UV level label

This is lightweight, informative, and follows the existing pattern for point-based layers. It's honest about the data resolution (one value per city, not a spatial grid).

#### Option B: Skip the map layer
If a single colored dot per city feels too sparse, we could skip the map layer entirely and only show UV on the weather tile. The rain radar sub-layer would remain the only weather map visualization.

#### Option C: Interpolated heatmap
Generate a UV gradient heatmap from multiple surrounding Open-Meteo grid points. This would look impressive but is misleading (UV doesn't vary meaningfully within a single city) and adds significant complexity.

## Decisions

- **Map**: No map layer — UV shown on the weather tile only
- **Clear-sky**: Fetch both `uv_index` and `uv_index_clear_sky` variants
- **DWD**: Also fetch DWD `uvi.json` as secondary official source

## Detailed Implementation Steps

### 1. Shared types (`shared/types.ts`)

Add optional UV fields to the weather interfaces:

```ts
// CurrentWeather — add:
uvIndex?: number;
uvIndexClearSky?: number;

// HourlyForecast — add:
uvIndex?: number;

// DailyForecast — add:
uvIndexMax?: number;
uvIndexClearSkyMax?: number;
```

### 2. Server: Open-Meteo ingestion (`packages/server/src/cron/ingest-weather.ts`)

Extend the existing fetch URL (lines 58–64):

- `&current=...` → append `,uv_index,uv_index_clear_sky`
- `&hourly=...` → append `,uv_index`
- `&daily=...` → append `,uv_index_max,uv_index_clear_sky_max`

Extend `OpenMeteoResponse` interface with the new fields. Update `transformWeatherData()` to map them to camelCase.

### 3. Server: DWD UV ingestion (new)

Add a DWD UV fetch inside the weather ingestion (German cities only, similar to how `fetchDwdAlerts()` works):

- Fetch `https://opendata.dwd.de/climate_environment/health/alerts/uvi.json`
- Parse the flat JSON, find the entry matching the city name
- Merge `{ dwdUvToday, dwdUvTomorrow, dwdUvDayAfter }` onto the weather data
- Only for `city.country === 'DE'` (same gate as DWD alerts)

Add to `shared/types.ts`:
```ts
// WeatherData — add:
dwdUv?: { today: number; tomorrow: number; dayAfter: number };
```

### 4. Frontend: WeatherStrip updates (`packages/web/src/components/strips/WeatherStrip.tsx`)

**Collapsed view**: Add a UV badge in the current conditions row:
- Display: "UV 3" with a colored dot/background using WHO color scale
- If clear-sky differs significantly from actual: show "(☀ 5)" to indicate potential

**Expanded view**:
- Hourly row: show UV index alongside temp/precip icons for each hour
- Daily row: show daily max UV with WHO color indicator
- DWD section: small "DWD forecast" line showing 3-day official UV values

### 5. Frontend: WeatherPopover updates (`packages/web/src/components/layout/WeatherPopover.tsx`)

Add current UV index to the popover's quick conditions display.

### 6. UV helper utilities (`packages/web/src/lib/uv-levels.ts`)

Create a small utility:
```ts
export function getUvLevel(index: number): { label: string; color: string } {
  if (index <= 2) return { label: 'low', color: 'green' };
  if (index <= 5) return { label: 'moderate', color: 'yellow' };
  if (index <= 7) return { label: 'high', color: 'orange' };
  if (index <= 10) return { label: 'veryHigh', color: 'red' };
  return { label: 'extreme', color: 'purple' };
}
```

Labels use i18n keys for translation.

### 7. i18n translations

Add keys in all 4 language files (de/en/tr/ar):
- `panel.weather.uv` — "UV Index"
- `panel.weather.uvClearSky` — "UV if sunny"
- `panel.weather.uvLevel.low/moderate/high/veryHigh/extreme`
- `panel.weather.dwdForecast` — "DWD Forecast"

### 8. Context & docs

- Update `.context/weather.md` to document UV ingestion (Open-Meteo params + DWD uvi.json)
- Update `CLAUDE.md` weather context reference if needed
