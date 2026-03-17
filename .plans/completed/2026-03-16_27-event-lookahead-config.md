# Plan 27: Configurable Event Lookahead Window

**Type:** feature
**Complexity:** simple
**Status:** ready

## Problem

`fetchKulturdaten()` in `packages/server/src/cron/ingest-events.ts` hardcodes a 7-day lookahead window (`Date.now() + 7 * 86400_000`). This limits event discovery. The window should be configurable per city via `CityDataSources`, defaulting to 14 days.

## Approach

Add an optional `lookaheadDays` field to `EventSourceConfig` in the shared types. Thread it through to `fetchKulturdaten()`. Default to 14 days when not specified.

**Why on `EventSourceConfig` (per-source) rather than a top-level `events` object:** The lookahead is only meaningful for Kulturdaten (Ticketmaster and gomus don't use date-range query params in our implementation). Putting it on the per-source config keeps the schema honest -- each source can have its own fetch parameters. If a future source also needs a date range, it's already in the right place.

**Alternative considered:** A top-level `eventsLookaheadDays` field on `CityDataSources`. Rejected because it would apply to all sources uniformly, which doesn't match the actual API usage.

## Changes

### 1. `shared/types.ts` -- add `lookaheadDays` to `EventSourceConfig`

```ts
export interface EventSourceConfig {
  source: 'kulturdaten' | 'ticketmaster' | 'gomus';
  url: string;
  lookaheadDays?: number; // Default: 14
}
```

### 2. `packages/server/src/cron/ingest-events.ts` -- use config value

In `ingestCityEvents`, pass the full `config` object (or just `config.lookaheadDays`) to `fetchKulturdaten`.

Update `fetchKulturdaten` signature:

```ts
async function fetchKulturdaten(sourceUrl: string, _cityId: string, lookaheadDays: number): Promise<CityEvent[]> {
```

Replace the hardcoded calculation:

```ts
// Before
const endDate = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

// After
const endDate = new Date(Date.now() + lookaheadDays * 86400_000).toISOString().slice(0, 10);
```

At the call site in `ingestCityEvents`:

```ts
case 'kulturdaten':
  fetched = await fetchKulturdaten(config.url, cityId, config.lookaheadDays ?? 14);
  break;
```

### 3. `packages/server/src/config/cities/berlin.ts` -- no change needed

The default of 14 applies automatically. Berlin's config stays as-is. If a city ever needs a different window, they add `lookaheadDays: 7` (or whatever) to their kulturdaten source entry.

## Files Affected

| File | Change |
|---|---|
| `shared/types.ts` | Add optional `lookaheadDays` field to `EventSourceConfig` |
| `packages/server/src/cron/ingest-events.ts` | Thread `lookaheadDays` to `fetchKulturdaten`, replace hardcoded 7 with parameter, default 14 |

## Testing

- Typecheck passes (`npm run typecheck`)
- Existing behavior preserved (default changes from 7 to 14, which is the desired outcome)
- No test files exist for ingest-events; no new tests needed for this minimal change
