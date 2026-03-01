# City Dashboard — Version 1

Migration plan: extract proven patterns from the worldmonitor repo into a focused, city-level dashboard product.

**Starting city:** Berlin
**Goal:** Public auto-updating city websites. Adding a city = adding a config file.
**License:** AGPL-3.0-or-later (required — derived from worldmonitor, which is AGPL-3.0-only, copyright Elie Habib). See [00-licensing.md](00-licensing.md).
**Repo:** New repo `city-monitor` with clean git history. No worldmonitor commits in history. Attribution via LICENSE, NOTICE, and per-file headers.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind v4 | Familiarity, fast builds |
| State | Zustand + @tanstack/react-query | Minimal boilerplate, built-in refetch/stale-while-revalidate |
| Charts | Recharts | React-native, declarative |
| Maps | MapLibre GL JS | Free, open-source, works for any city |
| Backend | Node + Express | Familiarity, wide ecosystem |
| Cache | In-memory (Map with TTL) + optional Upstash Redis | Zero-dep dev; Redis for production persistence |
| Scheduling | `node-cron` in-process | Simpler than Render cron jobs, no extra cost |
| AI | OpenAI GPT-5 (~$6/month/city) | Quality summarization, trivial cost |
| Deployment | Render.com (1 web service + 1 static site) | Simple, affordable |
| Error tracking | Sentry (free tier) | Essential for production |

---

## Architecture

```
Browser (React SPA)
  │
  ▼
Express API server (Render Web Service, $7/mo)
  ├── GET /api/:city/bootstrap     ← all data in one response
  ├── GET /api/:city/news/digest
  ├── GET /api/:city/news/summary
  ├── GET /api/:city/weather
  ├── GET /api/:city/transit
  ├── GET /api/:city/events
  ├── GET /api/:city/safety
  ├── GET /api/:city/map/points
  ├── GET /api/health
  │
  ├── node-cron (in-process scheduling):
  │   ├── feeds     — every 10 min
  │   ├── summaries — every 15 min
  │   ├── weather   — every 30 min
  │   ├── transit   — every 5 min
  │   └── events    — every 6 hours
  │
  └── Cache layer:
      ├── Primary: in-memory Map<string, {data, expiresAt}>
      └── Optional: Upstash Redis (for persistence across deploys)
```

**No separate cron processes.** The Express server runs `node-cron` jobs in-process. Simpler, cheaper, shared memory cache.

**No mandatory Redis.** In-memory cache works for a single-process server. Redis is optional — add it when you want data to survive deploys, or when you run multiple server instances.

---

## Cache Strategy

The cache layer abstracts over in-memory and Redis:

```typescript
// Try memory first → try Redis → run fetcher → write back to both
cache.get(key) → memoryCache.get(key) ?? redis?.get(key) ?? null
cache.set(key, data, ttl) → memoryCache.set(key, data, ttl); redis?.set(key, data, ttl)
```

From worldmonitor, we keep:
- **In-flight coalescing** — concurrent requests for the same key share one upstream fetch
- **Negative caching** — store `null` results with short TTL to prevent stampedes
- **TTL tiers** — different TTLs per data type (transit: 5min, news: 15min, events: 6h)

Reference: `.worldmonitor/server/_shared/redis.ts`

---

## City Configuration

Each city is a config object. The map, feeds, data sources, and theme are all per-city:

```typescript
interface CityConfig {
  id: string;                    // "berlin"
  name: string;                  // "Berlin"
  country: string;               // "DE"
  coordinates: { lat: number; lon: number };
  boundingBox: { north: number; south: number; east: number; west: number };
  timezone: string;              // "Europe/Berlin"
  languages: string[];           // ["de", "en"]
  map: {
    center: [lon: number, lat: number];  // [13.405, 52.52]
    zoom: number;                         // 11
    minZoom?: number;                     // 9
    maxZoom?: number;                     // 16
    bounds?: [[west, south], [east, north]];  // lock pan to city area
    style: string;                        // MapLibre style URL or local JSON
    layers?: CityMapLayer[];              // transit lines, district boundaries, POIs
  };
  theme: {
    accent: string;              // city brand color
  };
  feeds: FeedConfig[];
  dataSources: { ... };
}
```

Maps use the same global tile source (CARTO/OSM) for every city — only `center`, `zoom`, and `bounds` change. Per-city `layers` can add transit line overlays, district boundaries, or custom markers.

---

## Cost per City

| Item | Monthly cost |
|---|---|
| Render web service (Starter) | $7 |
| OpenAI GPT-5 (summarization) | ~$6 |
| Upstash Redis (free tier, optional) | $0 |
| Sentry (free tier) | $0 |
| **Total** | **~$13/city** |

Adding a second city on the same server: +$6/month (only the AI cost scales per city).

---

## Milestone Plans

Ordered for fastest path to a working MVP. Milestones 01–05 produce a deployable dashboard showing Berlin news.

| # | Milestone | What it delivers | Plan |
|---|---|---|---|
| 00 | [Licensing](00-licensing.md) | AGPL-3.0 license, NOTICE, attribution templates | **Do first** |
| 01 | [Scaffolding](01-scaffolding.md) | Monorepo, configs, worldmonitor reference copy | Foundation |
| 02 | [Server Core](02-server-core.md) | Express API, cache layer, in-process scheduler, health check | Foundation |
| 03 | [Frontend Shell](03-frontend-shell.md) | React app, layout, panel grid, city config, theme | Foundation |
| 04 | [News Pipeline](04-news-pipeline.md) | RSS ingestion, classification, digest API, bootstrap | **MVP data** |
| 05 | [News UI](05-news-ui.md) | News panel, React Query hooks, live-updating display | **MVP complete** |
| 06 | [Weather](06-weather.md) | Open-Meteo integration, weather panel | Enhancement |
| 07 | [AI Summaries](07-ai-summaries.md) | GPT-5 news briefings, summary panel | Enhancement |
| 08 | [City Map](08-city-map.md) | MapLibre map, city-centered, markers | Enhancement |
| 09 | [Transit](09-transit.md) | BVG/HAFAS integration, transit panel | Enhancement |
| 10 | [Events & Safety](10-events-safety.md) | City events, police reports | Enhancement |
| 11 | [Polish](11-polish.md) | i18n, dark/light theme, Sentry, SEO, performance | Hardening |
| 12 | [Multi-City](12-multi-city.md) | Second city config, routing, subdomain support | Scaling |
| 13 | [Production Deploy](13-production-deploy.md) | Render.com config, CI/CD, monitoring | Launch |

After all milestones: delete `.worldmonitor/` — the new codebase is fully standalone.

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| No mandatory Redis | In-memory cache primary | Simpler. One process = shared memory. Add Redis later for persistence. |
| No Render cron jobs | `node-cron` in Express process | Saves ~$4/month, simpler deployment, shared cache. |
| No proto/sebuf | Shared TypeScript types | ~8 endpoints don't need RPC codegen overhead. |
| No SSR/Next.js | Vite SPA | Dashboard is client-rendered; no SEO on dynamic content. Static shell is enough. |
| No WebSocket/SSE | React Query polling | Cron-driven data doesn't change fast enough to justify persistent connections. |
| No auth | Public dashboards | City data is public; no user accounts in v1. |
| GPT-5 over Groq/Ollama | Quality + simplicity | $6/month is trivial; no self-hosting; better multilingual summaries. |
| Recharts over D3 | React-native | D3 is overkill for standard bar/line charts. |
| Express over Hono/Fastify | Familiarity | Widest ecosystem; easy to find help. |
