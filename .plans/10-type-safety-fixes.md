# Plan: Type Safety Fixes

**Type:** refactor
**Complexity:** simple
**Files affected:** 2

## Overview

Two targeted type-safety improvements: deduplicate shared types in the web API module and replace `any` with a proper function type in the spider module.

## Change 1: Deduplicate shared types in `packages/web/src/lib/api.ts`

### Problem

Five interfaces (`NinaWarning`, `TrafficIncident`, `EmergencyPharmacy`, `Representative`, `PoliticalDistrict`) are defined locally in `api.ts` but already exist in `shared/types.ts`. This creates a maintenance risk where the two definitions drift apart.

### Nullability alignment analysis

| Interface | Field | Local | Shared | Impact |
|---|---|---|---|---|
| `NinaWarning` | `source` | `string` | `'mowas' \| 'biwapp' \| 'katwarn' \| 'dwd' \| 'lhp' \| 'police'` | Shared is stricter (union literal). Safe -- frontend code consuming a narrower type will still work; `string` comparisons against literal unions are fine in TS. |
| `TrafficIncident` | `road`, `from`, `to`, `delay`, `length`, `startTime`, `endTime` | `field?: T` (optional only) | `field?: T \| null` (optional + nullable) | Shared adds `\| null`. Frontend code accessing these fields must already handle `undefined`; `null` is a similar falsy value. Any strict equality checks (`=== undefined`) would break, but these fields are display-only strings/numbers rendered with optional chaining or fallbacks. Safe to adopt shared type. |
| `EmergencyPharmacy` | all | identical | identical | No change needed. |
| `Representative` | all | identical | identical | No change needed. |
| `PoliticalDistrict` | all | identical | identical | No change needed. |

**Decision:** Adopt the shared types directly. The `TrafficIncident` nullability widening (`T | null`) is safe because the frontend already uses optional chaining and fallback patterns for these optional fields. No consumer code changes needed.

### Steps

1. **Delete** the local interface definitions for `NinaWarning`, `TrafficIncident`, `EmergencyPharmacy`, `Representative`, `PoliticalDistrict` from `packages/web/src/lib/api.ts`.
2. **Add re-exports** on the existing `export type` line (line 152) that already re-exports shared types:
   ```ts
   export type { ..., NinaWarning, TrafficIncident, EmergencyPharmacy, Representative, PoliticalDistrict } from '@city-monitor/shared';
   ```
3. **Add to import** line (line 153) if any of these types are used within `api.ts` itself (they are: `NinaWarning`, `TrafficIncident`, `EmergencyPharmacy` are used in `BootstrapData`, and `PoliticalDistrict` is used in `api.getPolitical`). Add them to the existing `import type` on line 153.
4. **Run typecheck** (`npm run typecheck`) to verify no breakage from the nullability widening.

## Change 2: Replace `any` in `packages/web/src/components/map/spider.ts`

### Problem

The `SpiderHandlerSet` interface and `addSpiderHandler` function use `any` for callback function types, with eslint-disable comments to suppress the warning.

### Analysis

The `fn` field is used in two contexts:
- `map.off(event, layer, fn)` and `map.off(event, fn)` in `cleanupSpiderHandlers`
- `map.on(event, layer, fn)` and `map.on(event, fn)` in `addSpiderHandler`

MapLibre's `on`/`off` accept various listener signatures. The handlers stored here are MapLibre event callbacks. Using `(...args: unknown[]) => void` is the correct minimal type -- it says "some function we don't inspect the arguments of."

For `addSpiderHandler` line 136, the parameter types `(...a: any[]) => void` should also become `(...args: unknown[]) => void`.

### Steps

1. **In `SpiderHandlerSet` interface** (line 18): Change `fn: any` to `fn: (...args: unknown[]) => void`. Remove the `eslint-disable` comment on line 17.
2. **In `addSpiderHandler` function** (line 136): Change both `(...a: any[]) => void` occurrences to `(...args: unknown[]) => void`. Remove the `eslint-disable` comment on line 135.
3. **Run typecheck** to verify MapLibre's `on`/`off` accepts this type. If it doesn't (MapLibre may expect specific event handler signatures), fall back to a more specific MapLibre type or use `Parameters<typeof map.on>` to extract the right type. Most likely `unknown[]` will work because the values are passed through opaquely.

## Verification

- `npm run typecheck` -- must pass with no new errors
- `npm run lint` -- the two eslint-disable comments should no longer be needed; verify no new lint warnings
