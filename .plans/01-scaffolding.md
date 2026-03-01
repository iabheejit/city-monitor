# Milestone 01 — Scaffolding

**Goal:** Set up a new `city-monitor` repo with clean git history, copy worldmonitor as a local reference, configure build tooling.

**Depends on:** [00-licensing.md](00-licensing.md) (LICENSE, NOTICE, and attribution templates must be ready)

---

## Steps

### 0. Create the new repo

Create a **new** git repo `city-monitor` in a sibling directory (e.g., `D:\projects\city-monitor`). This repo has its own git history — no worldmonitor commits.

```bash
mkdir city-monitor && cd city-monitor && git init
```

Add the LICENSE (AGPL-3.0 with dual copyright header) and NOTICE file from milestone 00 as the first commit.

### 1. Copy worldmonitor to `.worldmonitor/`

Copy the entire worldmonitor repo contents into `city-monitor/.worldmonitor/` so coding agents can reference patterns during migration. Add `.worldmonitor/` to `.gitignore` — it's a local reference, **never committed** to the new repo.

Key reference files that later milestones depend on:
- `.worldmonitor/server/_shared/redis.ts` — cache layer (milestone 02)
- `.worldmonitor/server/_shared/constants.ts` — `yahooGate()` rate-gate pattern (milestone 02)
- `.worldmonitor/server/_shared/hash.ts` — FNV-1a hash for cache keys (milestone 02)
- `.worldmonitor/server/worldmonitor/news/v1/_classifier.ts` — keyword classifier (milestone 04)
- `.worldmonitor/server/worldmonitor/news/v1/_feeds.ts` — server-side feed structure (milestone 04)
- `.worldmonitor/server/worldmonitor/news/v1/summarize-article.ts` — summarization prompts (milestone 07)
- `.worldmonitor/server/worldmonitor/news/v1/_shared.ts` — LLM provider pattern (milestone 07)
- `.worldmonitor/server/worldmonitor/climate/v1/list-climate-anomalies.ts` — Open-Meteo usage (milestone 06)
- `.worldmonitor/src/config/feeds.ts` — feed tier/type metadata structure (milestone 04)
- `.worldmonitor/src/utils/circuit-breaker.ts` — circuit breaker pattern (milestone 05)
- `.worldmonitor/src/app/refresh-scheduler.ts` — visibility-aware polling (milestone 05)
- `.worldmonitor/api/bootstrap.js` — bootstrap batch-GET pattern (milestone 04)
- `.worldmonitor/api/rss-proxy.js` — RSS proxy with domain allowlist (milestone 04)

### 2. Initialize new project at repo root

Delete all existing worldmonitor files from root (they're preserved in `.worldmonitor/`). Initialize fresh:

```
city-dashboard/              # repo root
├── .worldmonitor/           # reference copy (gitignored)
├── packages/
│   ├── web/                 # React SPA
│   │   ├── src/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   └── server/              # Express API
│       ├── src/
│       │   └── db/
│       │       ├── index.ts         # DB connection (Drizzle + postgres driver)
│       │       └── schema.ts        # Drizzle table definitions
│       ├── drizzle.config.ts        # Drizzle Kit config
│       ├── package.json
│       └── tsconfig.json
├── shared/                  # Shared types
│   ├── types.ts
│   ├── package.json
│   └── tsconfig.json
├── package.json             # Workspace root
├── turbo.json               # Build orchestration
├── tsconfig.base.json       # Shared TS config
├── .gitignore
└── .nvmrc                   # Node 22
```

### 3. Root package.json (workspace)

```json
{
  "name": "city-dashboard",
  "private": true,
  "workspaces": ["packages/*", "shared"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "engines": { "node": ">=22" }
}
```

### 4. Shared types package

```json
{
  "name": "@city-dashboard/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./types.ts",
  "types": "./types.ts"
}
```

Initial `shared/types.ts` — just the city config and basic data types:

```typescript
export interface CityConfig {
  id: string;
  name: string;
  country: string;
  coordinates: { lat: number; lon: number };
  boundingBox: { north: number; south: number; east: number; west: number };
  timezone: string;
  languages: string[];
  map: {
    center: [number, number];
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    bounds?: [[number, number], [number, number]];
    style?: string;
    layers?: CityMapLayer[];
  };
  theme: { accent: string };
  feeds: FeedConfig[];
  dataSources: CityDataSources;
}

export interface FeedConfig {
  name: string;
  url: string;
  tier: 1 | 2 | 3 | 4;
  type: 'wire' | 'gov' | 'mainstream' | 'tech' | 'other';
  lang: string;
  category?: string;
}

export interface CityMapLayer {
  id: string;
  type: 'geojson' | 'markers';
  source: string;    // URL or inline data
  style?: Record<string, unknown>;
}

export interface CityDataSources {
  weather: { provider: 'open-meteo'; lat: number; lon: number };
  transit?: { provider: 'hafas'; operatorId: string; endpoint?: string };
  events?: { provider: 'rss' | 'api'; url: string };
  police?: { provider: 'rss'; url: string };
  openData?: { provider: 'ckan'; baseUrl: string };
}
```

### 5. Vite + React + Tailwind (packages/web)

Scaffold with: `npm create vite@latest web -- --template react-ts`

Dependencies:
- `react`, `react-dom` (v19)
- `tailwindcss`, `@tailwindcss/vite` (v4)
- `@tanstack/react-query`
- `zustand`

Minimal `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
```

### 6. Express server (packages/server)

Dependencies:
- `express`
- `cors`
- `node-cron`
- `drizzle-orm`
- `postgres` (driver — the `postgres` npm package, not `pg`)
- `tsx` (dev runner)
- `drizzle-kit` (dev — migration generation)

Minimal `src/index.ts`:
```typescript
import express from 'express';
const app = express();
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.listen(3001);
```

### 7. Drizzle config (`packages/server/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',            // migration output directory
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Add scripts to `packages/server/package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 8. Turbo config

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "persistent": true, "cache": false },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

---

## Done when

- [ ] `.worldmonitor/` contains the full worldmonitor repo
- [ ] `npm install` succeeds at root
- [ ] `npm run dev` starts both Vite (port 5173) and Express (port 3001)
- [ ] `curl localhost:3001/api/health` returns `{ "status": "ok" }`
- [ ] Vite proxy forwards `/api/*` to Express
- [ ] TypeScript compiles with no errors across all packages
- [ ] Drizzle config is in place; `npm run db:generate` works (schema can be empty initially)
