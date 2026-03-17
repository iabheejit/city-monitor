# Plan: Database Query Improvements

**Type:** bugfix/refactor
**Complexity:** simple
**Files affected:** 2

## Overview

Three targeted database query improvements: add `.limit()` to two unbounded reads and rewrite a `NOT IN` subquery to `NOT EXISTS` for better PostgreSQL performance.

## Changes

### 1. Add `.limit(200)` to `loadSafetyReports` (I5)

**File:** `packages/server/src/db/reads.ts`, line ~308
**Current:** Query selects all safety reports for a city with no row limit.
**Change:** Append `.limit(200)` after `.orderBy(desc(safetyReports.publishedAt))`.

This matches the existing pattern in `loadNewsItems` (line 338) which already uses `.limit(200)`. The query already orders by `publishedAt DESC`, so the limit will keep the 200 most recent reports.

### 2. Add `.limit(500)` to `loadEvents` (M7)

**File:** `packages/server/src/db/reads.ts`, line ~247
**Current:** Query selects all events for a city with no row limit.
**Change:** Append `.limit(500)` after `.orderBy(events.date)`.

The cron caps at `MAX_FUTURE_EVENTS = 200`, so 500 provides a comfortable buffer (events are ordered by date ascending, so we keep the soonest 500). The limit is intentionally higher than 200 because the events table may contain both past and future events within the 7-day retention window.

### 3. Rewrite orphan-summary cleanup to `NOT EXISTS` (M3)

**File:** `packages/server/src/cron/data-retention.ts`, lines 81-83
**Current:**
```ts
db.delete(aiSummaries).where(
  notInArray(aiSummaries.headlineHash, db.select({ hash: newsItems.hash }).from(newsItems))
)
```
**Change:** Rewrite using Drizzle's `exists()` / `notExists()` + `sql` for a correlated subquery:
```ts
import { exists, sql } from 'drizzle-orm';

db.delete(aiSummaries).where(
  notExists(
    db.select({ one: sql`1` })
      .from(newsItems)
      .where(eq(newsItems.hash, aiSummaries.headlineHash))
  )
)
```

**Import changes in `data-retention.ts`:** Replace `notInArray` with `notExists, eq` (add `eq` if not already imported). Add `sql` from `drizzle-orm`.

**Why NOT EXISTS:** PostgreSQL's `NOT IN` subquery has two issues: (1) it materializes the full subquery result set, and (2) it has surprising NULL semantics (if any hash is NULL, the entire `NOT IN` returns no rows). `NOT EXISTS` uses a correlated semi-join that the planner can optimize with an index scan and handles NULLs correctly.

## Implementation Checklist

1. Edit `packages/server/src/db/reads.ts`:
   - Line ~247: add `.limit(500)` to `loadEvents`
   - Line ~308: add `.limit(200)` to `loadSafetyReports`
2. Edit `packages/server/src/cron/data-retention.ts`:
   - Update import: replace `notInArray` with `eq, notExists` and add `sql`
   - Rewrite orphan_summaries cleanup (lines 81-83) to use `NOT EXISTS`
3. Run `npx turbo run typecheck` to verify no type errors
4. Run `npx turbo run test --filter=@city-monitor/server` to verify no test regressions

## Testing

These are simple query-shape changes with no behavioral difference (aside from the row limits being enforced). The existing test suite should pass unchanged. No new tests needed.
