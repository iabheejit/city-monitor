# Plan 29: Type Consolidation and api.ts Import Cleanup

**Type:** refactor
**Complexity:** simple
**Risk:** low -- pure type-level changes, no runtime behavior affected

## Problem

`packages/web/src/lib/api.ts` defines 4 interfaces/types locally that should live in `shared/types.ts`:
- `AirQuality` (lines 56-71) -- identical copy exists in server's `ingest-weather.ts`
- `TransitAlert` (lines 40-51) -- near-identical to server's `ingest-transit.ts` (minor difference: web has `lines?: string[]` optional, server has `lines: string[]` required)
- `BootstrapData` (lines 16-38) -- web-only but belongs in shared for potential server-side typing
- `NewsSummaryData` (line 77) -- web-only but the shape matches server's news summary response

Additionally, the import/export block (lines 11-14, 53-54, 74-75) is scattered across 6 statements that should be consolidated into 2.

## Approach

### 1. Move types to `shared/types.ts`

Add these 4 types to `shared/types.ts`:

**`TransitAlert`** -- Use the server's definition (`lines: string[]` required). The web already handles undefined via `alert.lines ?? [alert.line]`, so making `lines` required is safe. The server always provides `lines`.

**`AirQuality`** -- Identical on both sides. Move as-is.

**`NewsSummaryData`** -- Move as-is from api.ts.

**`BootstrapData`** -- Move as-is. It imports other shared types so it naturally belongs in shared.

### 2. Update server to import from shared

- `packages/server/src/cron/ingest-transit.ts`: Delete local `TransitAlert`, import from `@city-monitor/shared`
- `packages/server/src/cron/ingest-weather.ts`: Delete local `AirQuality`, import from `@city-monitor/shared`
- `packages/server/src/db/reads.ts`: Change import from `../cron/ingest-transit.js` to `@city-monitor/shared`
- `packages/server/src/db/writes.ts`: Change import from `../cron/ingest-transit.js` to `@city-monitor/shared`
- `packages/server/src/db/writes.test.ts`: Change import from `../cron/ingest-transit.js` to `@city-monitor/shared`
- `packages/server/src/cron/ingest-transit.test.ts`: Change import to `@city-monitor/shared` (keep `createTransitIngestion` import from local)
- `packages/server/src/routes/air-quality.ts`: Change import from `../cron/ingest-weather.js` to `@city-monitor/shared`
- `packages/server/src/routes/transit.ts`: Change import from `../cron/ingest-transit.js` to `@city-monitor/shared`
- `packages/server/src/routes/transit.test.ts`: Change import from `../cron/ingest-transit.js` to `@city-monitor/shared`

### 3. Consolidate api.ts imports/exports

Replace the 6 scattered import/export statements (lines 11-14, 53-54, 74-75) with 2 clean statements:

```typescript
// Re-export all shared types for backward compatibility
export type {
  WeatherData, ApiResponse, HistoryPoint, NewsItem, NewsDigest,
  CityEvent, SafetyReport, AirQualityGridPoint, ConstructionSite,
  WaterLevelData, WaterLevelStation, AedLocation, BathingSpot,
  BudgetSummary, BudgetAreaSummary, BudgetCategoryAmount,
  BuergeramtData, BuergeramtService, SocialAtlasFeatureProps,
  LaborMarketSummary, WastewaterSummary, WastewaterPathogen,
  PopulationFeatureProps, PopulationSummary, FeuerwehrSummary,
  FeuerwehrMonthData, PollenForecast, PollenType, PollenIntensity,
  PollenTypeForecast, NoiseSensor, CouncilMeeting, NinaWarning,
  TrafficIncident, EmergencyPharmacy, Representative, PoliticalDistrict,
  TransitAlert, AirQuality, BootstrapData, NewsSummaryData,
} from '@city-monitor/shared';

// Import types used locally in api object definitions
import type {
  WeatherData, ApiResponse, HistoryPoint, NewsDigest,
  CityEvent, SafetyReport, AirQualityGridPoint, ConstructionSite,
  WaterLevelData, AedLocation, BathingSpot, BudgetSummary,
  BuergeramtData, LaborMarketSummary, WastewaterSummary,
  PopulationSummary, FeuerwehrSummary, PollenForecast, NoiseSensor,
  CouncilMeeting, NinaWarning, TrafficIncident, EmergencyPharmacy,
  PoliticalDistrict, TransitAlert, AirQuality, BootstrapData,
  NewsSummaryData,
} from '@city-monitor/shared';
```

Remove the 4 local type definitions (AirQuality, TransitAlert, BootstrapData, NewsSummaryData) from api.ts.

### 4. ScSensorData -- no action

`ScSensorData` in `ingest-noise-sensors.ts` is an internal Sensor.Community API response shape. It has no consumers outside that module (tests use plain objects). Exporting it would expose an unstable external API contract as a project type. Leave it private.

## Files Modified

1. `shared/types.ts` -- Add 4 types (AirQuality, TransitAlert, BootstrapData, NewsSummaryData)
2. `packages/web/src/lib/api.ts` -- Remove local types, consolidate imports/exports
3. `packages/server/src/cron/ingest-transit.ts` -- Delete local TransitAlert, import from shared
4. `packages/server/src/cron/ingest-weather.ts` -- Delete local AirQuality, import from shared
5. `packages/server/src/db/reads.ts` -- Change TransitAlert import source
6. `packages/server/src/db/writes.ts` -- Change TransitAlert import source
7. `packages/server/src/db/writes.test.ts` -- Change TransitAlert import source
8. `packages/server/src/cron/ingest-transit.test.ts` -- Change TransitAlert import source
9. `packages/server/src/routes/air-quality.ts` -- Change AirQuality import source
10. `packages/server/src/routes/transit.ts` -- Change TransitAlert import source
11. `packages/server/src/routes/transit.test.ts` -- Change TransitAlert import source

## Verification

Run `npx turbo run typecheck` to confirm no type errors across both packages.
