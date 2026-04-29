# Fix dead feeds and reduce unnecessary feed fetches

## Problem

1. Two Berlin feeds are dead: `Berlin.de News` (410 Gone) and `RBB Polizei` (404)
2. All feeds are re-fetched every cron cycle (10 min) because the per-feed cache TTL (600s) equals the cron interval — cache always expires before next run

## Fix

### 1. Remove dead feeds from Berlin config
- Remove `Berlin.de News` (410 Gone) — no replacement found
- Remove `RBB Polizei` (404) from `feeds` array — police reports still flow through `ingest-safety` via `dataSources.police` (which silently skips on 404)

### 2. Increase per-feed cache TTL
Change `fetchOneFeed` cache TTL from 600s → 900s (15 min). Since the cron runs every 10 min, each feed survives one cron cycle in cache. Effective fetch interval becomes ~20 min. The news digest is still rebuilt every 10 min from cached feed data.

## Files
- `packages/server/src/config/cities/berlin.ts` — remove 2 dead feeds
- `packages/server/src/cron/ingest-feeds.ts` — change per-feed cache TTL from 600 to 900
