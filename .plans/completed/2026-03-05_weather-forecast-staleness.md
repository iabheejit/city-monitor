# Weather Forecast — Remove Staleness Guard, Fix Zod Stripping

## Problem

In prod, when the Open-Meteo API fails for >6 hours, `loadWeather()` discards
the DB data due to a hard 6-hour staleness guard (reads.ts:77). This causes:

1. Cache warm on startup → `loadWeather` returns null → no weather in cache
2. Bootstrap → returns null for weather → tile invisible
3. Individual query → cache miss → DB miss (6h guard) → empty fallback → `!current` → renders null

Secondary bug: The Zod schemas (`WeatherDataSchema`, etc.) don't include UV
fields (`uvIndex`, `uvIndexClearSky`, `uvIndexMax`, `uvIndexClearSkyMax`), so
when data is loaded from DB and validated, UV data is stripped. UV info only
works while data comes from the in-memory cache (which has the unvalidated
original object).

## Fix

### 1. Remove the 6h staleness guard in `loadWeather()` (reads.ts:77)

Delete the line:
```ts
if (row.fetchedAt && Date.now() - row.fetchedAt.getTime() > 6 * 60 * 60 * 1000) return null;
```

The freshness system already handles stale display — the TileFooter turns amber
when data is older than 45 minutes (`FRESH_MAX_AGE` in WeatherStrip).

### 2. Update Zod schemas to include UV fields (shared/schemas.ts)

- `CurrentWeatherSchema`: add `uvIndex: z.number().optional()`, `uvIndexClearSky: z.number().optional()`
- `HourlyForecastSchema`: add `uvIndex: z.number().optional()`
- `DailyForecastSchema`: add `uvIndexMax: z.number().optional()`, `uvIndexClearSkyMax: z.number().optional()`

### 3. No other changes needed

Everything else is already in place:
- DB table: `weather_snapshots` with JSONB columns
- DB write: `saveWeather()` in writes.ts
- Cache warm: `warmCache()` calls `loadWeather()` and populates cache with real `fetchedAt`
- Route: cache → DB fallback → empty default
- Frontend: `useWeather` hook, `useFreshness`, `TileFooter`
- Bootstrap: weather included in `CK.bootstrapKeys()`

## Files to Change

| File | Change |
|---|---|
| `packages/server/src/db/reads.ts` | Remove 6h staleness guard (line 77) |
| `shared/schemas.ts` | Add UV fields to weather Zod schemas |

## Testing

- Unit test: `loadWeather` returns data regardless of age
- Unit test: Zod schemas pass through UV fields
