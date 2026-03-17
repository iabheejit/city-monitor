# Plan: Deduplicate NewsItem and NewsDigest Types

**Type:** refactor
**Complexity:** simple
**Date:** 2026-03-16

## Problem

`NewsItem` and `NewsDigest` are defined in two places:
- `packages/server/src/cron/ingest-feeds.ts` (lines 22-41) -- has `sourceUrl` and `lang` fields
- `packages/web/src/lib/api.ts` (lines 38-55) -- omits `sourceUrl` and `lang`

This violates DRY and risks the types drifting apart.

## Approach

Move both interfaces to `shared/types.ts` (the existing shared types file) with all fields present. The shared type uses the server's superset definition. The web side simply ignores the extra fields at runtime (they may or may not be present in API responses, but having them typed doesn't hurt).

**Alternative considered:** Create a base `NewsItem` in shared and extend it in the server with `sourceUrl` and `lang`. Rejected because the complexity isn't warranted -- the web side having two extra optional-at-runtime fields is harmless, and a single canonical type is simpler to maintain.

## Changes

### 1. `shared/types.ts` -- Add NewsItem and NewsDigest

Add after the existing types (e.g., after `PollenForecast` or at end before the council meetings re-export):

```ts
// News feed items
export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  description?: string;
  category: string;
  tier: number;
  lang: string;
  location?: { lat: number; lon: number; label?: string };
  importance?: number;
}

export interface NewsDigest {
  items: NewsItem[];
  categories: Record<string, NewsItem[]>;
  updatedAt: string;
}
```

### 2. `packages/server/src/cron/ingest-feeds.ts` -- Remove local types, re-export from shared

- Remove the `NewsItem` and `NewsDigest` interface definitions (lines 22-41).
- Add: `export type { NewsItem, NewsDigest } from '@city-monitor/shared';`
- This preserves the existing export surface so all server-side consumers (`writes.ts`, `warm-cache.ts`, `summarize.ts`, `news.ts`, `ingest-feeds.test.ts`) continue to work unchanged.

### 3. `packages/web/src/lib/api.ts` -- Remove local types, re-export from shared

- Remove the `NewsItem` and `NewsDigest` interface definitions (lines 38-55).
- Add: `export type { NewsItem, NewsDigest } from '@city-monitor/shared';`
- All web consumers (`useNewsDigest.ts`, `NewsStrip.tsx`, `news-safety.ts`) continue to work unchanged.

## Files Affected

| File | Change |
|---|---|
| `shared/types.ts` | Add `NewsItem` and `NewsDigest` interfaces |
| `packages/server/src/cron/ingest-feeds.ts` | Remove interfaces, add re-export from shared |
| `packages/web/src/lib/api.ts` | Remove interfaces, add re-export from shared |

## Verification

1. `npm run typecheck` -- confirms all imports resolve and types match
2. `npx turbo run test` -- confirms no runtime regressions
