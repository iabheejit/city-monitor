# Tighten Data Retention

- **Date**: 2026-03-24
- **Status**: approved
- **Type**: refactor

## Problem

The Render PostgreSQL DB (1 GB, 1 city in production) is at 90% storage. The nightly retention cron keeps 7-30 days of snapshots, but most snapshot types only need the latest row — only 4 types are read by `/history` endpoints. High-frequency types like `bbk-nina` and `tomtom-traffic` (every 5min) accumulate ~2,000 JSONB rows/week that are never read.

## Approach

Tighten time-based retention across the board and add row-count caps for non-history types as a safety net:

1. **History types** (4): unchanged — they match their max query range
2. **Non-history types** (20): reduce to 2 days time-based + cap at 100 rows per (cityId, type)
3. **Non-snapshot tables**: reduce summaries from 30 to 7 days
4. **Log deleted row counts** for observability

The row-count cap ensures even if the cron misses a night, high-frequency types can't run away. The 100-row cap gives ~8 hours of data for 5-min types, plenty for debugging.

### Retention after this change

| Category | Types | Before | After |
|----------|-------|--------|-------|
| History | `open-meteo` | 7 days | 7 days |
| History | `aqi-grid`, `pegelonline` | 30 days | 30 days |
| History | `ba-labor-market` | 730 days | 730 days |
| Non-history (high-freq) | nina, traffic, dnms, disruptions, roadworks, weather alerts (transit) | 7 days | 2 days + 100 row cap |
| Non-history (med-freq) | pollen, pharmacies, appointments, meetings, bathing, wastewater | 7 days | 2 days + 100 row cap |
| Non-history (infrequent) | budget, aeds, social-atlas, feuerwehr, population, abgwatch-* | 30 days | 7 days + 100 row cap |
| Non-snapshot | news, events, safety | 7 days | 3 days |
| Summaries | aiSummaries + orphan cleanup | 30 days | 7 days |

### Storage impact estimate (1 city)

Worst offenders today → after:
- `bbk-nina` (5min, 7d): ~2,016 rows → ~100 rows (cap)
- `tomtom-traffic` (5min, 7d): ~2,016 → ~100
- `sc-dnms` (10min, 7d): ~1,008 → ~288 (2d)
- `vbb-disruptions` (15min, 7d): ~672 → ~192 (2d)
- Infrequent types (30d): ~30 each → ~7 each

## Changes

| File | Change |
|------|--------|
| `packages/server/src/cron/data-retention.ts` | Split config into `HISTORY_RETENTION` (4 time-based) and `CAPPED_RETENTION` (20 types: time cutoff + row count cap). Add `pruneByRowCount()` using raw SQL with `ROW_NUMBER() OVER (PARTITION BY city_id)`. Log total deleted count. |
| `packages/server/src/cron/data-retention.test.ts` | Update task count expectations. Verify row-count pruning is called for non-history types. |
| `.context/data-layer.md` | Update retention table to reflect new periods and row-count caps. |

### Row-count cap SQL

```sql
DELETE FROM snapshots
WHERE type = $1
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY fetched_at DESC) AS rn
      FROM snapshots WHERE type = $1
    ) sub WHERE rn <= $2
  )
```

Runs as a second pass after time-based deletion, per type. Handles multi-city correctly.

## Tests

- Update existing test task count expectation (time tasks + row-cap tasks + non-snapshot tasks)
- Verify row-count prune SQL is executed for capped types
- Existing resilience test (one failure doesn't block others) still applies

## Out of Scope

- Changing cron schedule (3am nightly is fine)
- VACUUM / REINDEX (Render manages this)
- Changing ingestion frequencies
- DB storage health endpoint
