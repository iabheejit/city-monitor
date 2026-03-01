# Milestone 04 — News Pipeline

**Goal:** Server-side RSS feed ingestion, keyword classification, digest caching, and API endpoints. This is the first real data flowing through the system.

**Depends on:** [02-server-core.md](02-server-core.md)

---

## Steps

### 1. RSS parser (`packages/server/src/lib/rss-parser.ts`)

Parse RSS 2.0 and Atom feeds into a normalized `FeedItem[]`.

**Reference:** `.worldmonitor/server/worldmonitor/news/v1/list-feed-digest.ts`
- The digest builder fetches and parses feeds with regex-based XML parsing
- Handles `<item>` (RSS) and `<entry>` (Atom), CDATA, XML entities

For the new project, use `fast-xml-parser` instead of regex — it's already proven in worldmonitor's client-side code and is more maintainable:

```typescript
import { XMLParser } from 'fast-xml-parser';

interface FeedItem {
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
  imageUrl?: string;
}

export function parseFeed(xml: string): FeedItem[]
```

### 2. Feed fetcher (`packages/server/src/cron/ingest-feeds.ts`)

Fetch all feeds for active cities, parse, classify, deduplicate, cache.

**Reference files:**
- `.worldmonitor/server/worldmonitor/news/v1/list-feed-digest.ts` — the digest builder
  - `BATCH_CONCURRENCY = 20`, `FEED_TIMEOUT_MS = 8000`, `OVERALL_DEADLINE_MS = 25000`
  - Per-feed caching: `rss:feed:v1:{url}` with 600s TTL
  - Digest caching: `news:digest:v1:{variant}:{lang}` with 900s TTL
  - In-memory fallback cache as last resort
- `.worldmonitor/server/worldmonitor/news/v1/_feeds.ts` — server-side feed structure (`VARIANT_FEEDS`)
- `.worldmonitor/api/rss-proxy.js` — domain allowlist for SSRF protection

Adapt the pattern:
```
For each active city:
  1. Load feeds from city config
  2. Fetch feeds in parallel (batch of 10, 8s per-feed timeout, 25s deadline)
  3. Parse each feed → FeedItem[]
  4. Classify each item → category + tier (step 3 below)
  5. Deduplicate by FNV-1a hash of URL + title
  6. Write new articles to Postgres (news_articles table, upsert by hash)
  7. Query Postgres for latest articles → sort by tier then recency
  8. Build digest JSON → write to memory cache: `{cityId}:news:digest` (TTL 900s)
  9. Build per-category JSONs → write to cache: `{cityId}:news:{category}` (TTL 900s)
```

The key difference from the cache-only approach: articles persist in Postgres, so data survives server restarts. The cache is rebuilt from Postgres on startup (via cache warmup from milestone 02).

### 3. Keyword classifier (`packages/server/src/lib/classifier.ts`)

Port worldmonitor's keyword classification with city-specific categories.

**Reference:** `.worldmonitor/server/worldmonitor/news/v1/_classifier.ts`
- Four priority tiers: CRITICAL → HIGH → MEDIUM → LOW → info
- Word-boundary matching for short ambiguous terms
- Exclusion list for lifestyle noise
- Tech variant has additional keyword maps

Adapt for city categories:

```typescript
type CityCategory = 'local' | 'politics' | 'transit' | 'culture' | 'crime' | 'weather' | 'economy' | 'sports';

const BERLIN_KEYWORDS: Record<CityCategory, { high: string[]; medium: string[] }> = {
  transit: {
    high: ['Sperrung', 'Störung', 'Ausfall', 'BVG', 'S-Bahn', 'U-Bahn', 'Verspätung', 'gesperrt'],
    medium: ['Baustelle', 'Umleitung', 'Tram', 'Bus', 'Ringbahn'],
  },
  crime: {
    high: ['Mord', 'Überfall', 'Festnahme', 'Messerangriff', 'Schießerei'],
    medium: ['Diebstahl', 'Einbruch', 'Polizei', 'Razzia', 'Verdächtig'],
  },
  politics: {
    high: ['Senat', 'Abgeordnetenhaus', 'Bezirksbürgermeister'],
    medium: ['Wahl', 'Koalition', 'Protest', 'Demo', 'Bezirk', 'Bürgermeister'],
  },
  culture: {
    high: ['Berlinale', 'Museumsinsel', 'Philharmonie'],
    medium: ['Ausstellung', 'Konzert', 'Festival', 'Theater', 'Galerie', 'Kino'],
  },
  weather: {
    high: ['Unwetter', 'Hitzewelle', 'Sturm', 'Hochwasser'],
    medium: ['Regen', 'Schnee', 'Gewitter', 'Temperatur'],
  },
  economy: {
    high: ['Insolvenz', 'Startup', 'Ansiedlung'],
    medium: ['Arbeitsmarkt', 'Miete', 'Immobilien', 'Wirtschaft'],
  },
  sports: {
    high: ['Hertha', 'Union Berlin', 'Alba Berlin', 'Eisbären'],
    medium: ['Bundesliga', 'Olympiastadion', 'Marathon'],
  },
  local: { high: [], medium: [] },  // fallback category
};

export function classifyHeadline(title: string, cityId: string): { category: CityCategory; confidence: number }
```

### 4. API endpoints

```typescript
// packages/server/src/routes/news.ts

// Full digest — all categories
GET /api/:city/news/digest → {
  items: NewsItem[],
  categories: Record<string, NewsItem[]>,
  updatedAt: string
}

// Bootstrap — all city data in one response
GET /api/:city/bootstrap → {
  news: NewsDigest,
  weather: WeatherData | null,    // null until milestone 06
  transit: TransitAlert[] | null, // null until milestone 09
  events: CityEvent[] | null,     // null until milestone 10
}
```

**Reference:** `.worldmonitor/api/bootstrap.js`
- Single batch-GET for all data types
- Client calls on page load to hydrate everything at once

The bootstrap endpoint reads from the memory cache via `cache.getBatch()`. On cache miss, it queries Postgres directly.

### 5. Wire up the scheduler

Connect `ingest-feeds` cron job (from milestone 02's stub) to the actual feed ingestion handler. Set `runOnStart: true` so data is available immediately after server boot.

---

## Done when

- [ ] Feed ingestion cron runs every 10 min and fetches Berlin RSS feeds
- [ ] Feeds are parsed, classified by category, written to Postgres, and cached
- [ ] `GET /api/berlin/news/digest` returns classified news items
- [ ] `GET /api/berlin/bootstrap` returns the news digest (other fields null)
- [ ] Duplicate articles are filtered by hash (no duplicate URLs/titles in DB)
- [ ] Failed feeds don't crash the ingestion (graceful error handling per feed)
- [ ] Feed fetch respects timeouts (8s per feed, 25s overall)
