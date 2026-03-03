# Plan 05: Rewrite ingest-feeds.ts (Remove worldmonitor derivation)

## Goal

Rewrite the feed ingestion cron job from scratch, removing the structural derivation from worldmonitor's `list-feed-digest.ts`.

## Context

`packages/server/src/cron/ingest-feeds.ts` was adapted from worldmonitor's feed digest builder. The skeleton — batch-fetch with deadline → `Promise.allSettled` → deduplicate by hash → sort by tier/recency → cache — matches the original. The constants `FEED_TIMEOUT_MS = 8_000` and `OVERALL_DEADLINE_MS = 25_000` also match.

However, city-monitor adds significant original functionality: Postgres persistence, LLM-based relevance filtering, assessment merging, DB-based dedup for known items.

## Also covers

- `packages/server/src/lib/rss-parser.ts` — already independent (uses `fast-xml-parser` vs original's regex), just needs header removal
- `packages/server/src/cron/summarize.ts` — already independent (different concept: batch headlines → single summary vs per-article summarization), just needs header removal

## Callers

- `app.ts` — registers the cron job via `createFeedIngestion(cache, db)`
- `warm-cache.ts` — imports `applyDropLogic` and types `NewsDigest`, `NewsItem`
- `news.ts` route — reads from cache keys set by this module
- `ingest-feeds.test.ts` — test suite

## Approach

Rewrite with a different internal structure while preserving the same behavior:

1. **Different constants**: Use 10s per-feed timeout, 30s overall deadline (reasonable independent choices)
2. **Different flow structure**: Instead of nested loops with batch slicing, use a `Promise` pool pattern (or `p-limit` for concurrency control)
3. **Different dedup**: Instead of building a `Set<string>` post-fetch, dedup inline during parsing using a `Map`
4. **Keep the original features**: LLM filtering, DB assessment merging, cache writes — these are all original city-monitor code

## Steps

1. Rewrite `packages/server/src/cron/ingest-feeds.ts`:
   - Same public API: `createFeedIngestion(cache, db)`, `applyDropLogic()`, types `NewsItem`, `NewsDigest`
   - Fresh internal structure: concurrent pool instead of batch slicing
   - Fresh constants (10s feed timeout, 30s deadline, concurrency 8)
   - Inline dedup during feed parsing
   - Same LLM filter and DB persistence logic (already original)
2. Remove attribution header from `packages/server/src/lib/rss-parser.ts` (already independent)
3. Remove attribution header from `packages/server/src/cron/summarize.ts` (already independent)
4. Run `ingest-feeds.test.ts` and `summarize.test.ts`
5. Manual verification: trigger feed ingestion via health endpoint or wait for next cron cycle

## Notes

- The `rss-parser.ts` rewrite is not needed — it already uses `fast-xml-parser` and shares no code with the original. Just remove the header.
- `summarize.ts` similarly shares no code with the original `summarize-article.ts` — different SDK (openai npm), different concept (batch summary vs per-article), different caching logic. Just remove the header.
