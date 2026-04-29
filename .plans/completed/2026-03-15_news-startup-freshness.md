# Skip news startup fetch when DB data is still fresh

## Problem

On server start, `ingest-feeds` runs and fetches all RSS feeds (14+ HTTP requests) even when the DB has perfectly usable news data. This happens because `maxAgeSeconds: 600` for `ingest-feeds` in `FRESHNESS_SPECS` matches the cron interval exactly — any restart with >10 min downtime triggers a full re-fetch.

The cache warming already loads news from Postgres into the in-memory cache, so the API serves news immediately. The regular cron (`*/10 * * * *`) refreshes within 10 minutes regardless.

## Fix

Increase `maxAgeSeconds` for `ingest-feeds` from 600 → 3600 (1 hour). This means:
- **Restart with <1h old news:** Skip startup fetch — cron refreshes within 10 min
- **Restart with >1h old news:** Startup fetch runs (data is genuinely stale)

Also increase `summarize-news` from 1200 → 21600 (6h, matching its cron interval). The current 1200s threshold means every restart >20 min triggers re-summarization, which costs an LLM API call.

## Files

- `packages/server/src/app.ts` — lines 103-104: update `maxAgeSeconds` values
- `packages/server/src/db/warm-cache.test.ts` — update any tests asserting on these thresholds (if any)
