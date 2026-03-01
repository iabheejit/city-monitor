# Milestone 02 — Server Core

**Goal:** Build the cache layer, in-process scheduler, and Express middleware foundation.

**Depends on:** [01-scaffolding.md](01-scaffolding.md)

---

## Steps

### 1. Cache layer (`packages/server/src/lib/cache.ts`)

Port the `cachedFetchJson` pattern from worldmonitor with these changes:
- Primary store: in-memory `Map<string, { data: unknown; expiresAt: number }>`
- Optional secondary: Upstash Redis (only if `UPSTASH_REDIS_REST_URL` is set)
- Keep: in-flight coalescing, negative caching with sentinel, TTL support
- Drop: Vercel-specific env prefixing, preview deployment key scoping

**Reference:** `.worldmonitor/server/_shared/redis.ts`
- `cachedFetchJson()` at line ~104 — the main cache-aside function
- `inflight` Map for coalescing at line ~95
- `NEG_SENTINEL` for negative caching
- `getCachedJsonBatch()` for pipeline reads (used by bootstrap)

API surface:
```typescript
// Core
cache.get<T>(key: string): Promise<T | null>
cache.set(key: string, data: unknown, ttlSeconds: number): Promise<void>
cache.delete(key: string): Promise<void>

// Cache-aside with coalescing (main pattern from worldmonitor)
cache.fetchJson<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T | null>, negativeTtlSeconds?: number): Promise<T | null>

// Batch GET for bootstrap endpoint
cache.getBatch(keys: string[]): Promise<Record<string, unknown>>
```

### 2. Rate-gate factory (`packages/server/src/lib/rate-gate.ts`)

Generalize worldmonitor's `yahooGate()` into a reusable factory:

**Reference:** `.worldmonitor/server/_shared/constants.ts`
- `yahooGate()` — serial promise queue with minimum gap between requests

```typescript
export function createRateGate(minGapMs: number): () => Promise<void>
```

This will be used for any external API with rate limits (transit APIs, etc.).

### 3. In-process scheduler (`packages/server/src/lib/scheduler.ts`)

Use `node-cron` to run data ingestion jobs inside the Express process.

```typescript
import cron from 'node-cron';

interface ScheduledJob {
  name: string;
  schedule: string;        // cron expression
  handler: () => Promise<void>;
  runOnStart?: boolean;    // fire immediately on server boot
}

export function startScheduler(jobs: ScheduledJob[]): void
```

Jobs to register (handlers are stubs for now, implemented in later milestones):
- `ingest-feeds` — `*/10 * * * *` (every 10 min), `runOnStart: true`
- `summarize-news` — `5,20,35,50 * * * *` (every 15 min, offset from feeds)
- `ingest-weather` — `*/30 * * * *` (every 30 min), `runOnStart: true`
- `ingest-transit` — `*/5 * * * *` (every 5 min), `runOnStart: true`
- `ingest-events` — `0 */6 * * *` (every 6 hours)

### 4. FNV-1a hash utility (`packages/server/src/lib/hash.ts`)

Copy the FNV-1a hash function from worldmonitor for building deterministic cache keys.

**Reference:** `.worldmonitor/server/_shared/hash.ts`

### 5. City config loader (`packages/server/src/config/`)

Server-side city config that mirrors the shared types. Load active cities from `ACTIVE_CITIES` env var.

```typescript
// config/cities/berlin.ts — Berlin config with feeds and data sources
// config/index.ts — loads all active city configs

export function getActiveCities(): CityConfig[]
export function getCityConfig(cityId: string): CityConfig | undefined
```

Create the Berlin config with ~10 local RSS feeds and data source URLs.

### 6. Express app structure (`packages/server/src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import { startScheduler } from './lib/scheduler';
import { healthRouter } from './routes/health';
// ... future route imports

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRouter);
// app.use('/api/:city', cityRouter);  — added in milestone 04

// Start scheduler
startScheduler(jobs);

app.listen(Number(process.env.PORT) || 3001);
```

### 7. Health endpoint (`packages/server/src/routes/health.ts`)

```typescript
GET /api/health → {
  status: 'ok',
  uptime: process.uptime(),
  activeCities: ['berlin'],
  cache: { type: 'memory' | 'redis', connected: boolean },
  scheduler: { jobs: [{ name, lastRun, nextRun }] }
}
```

---

## Done when

- [ ] `cache.fetchJson()` works with in-memory store and coalescing
- [ ] `cache.fetchJson()` also writes to Redis when `UPSTASH_REDIS_REST_URL` is set
- [ ] `createRateGate(600)` enforces 600ms minimum gap between calls
- [ ] `node-cron` jobs are registered and fire on schedule (stubs log to console)
- [ ] `GET /api/health` returns status with cache type and scheduler info
- [ ] Berlin city config loads with feeds and data source URLs
