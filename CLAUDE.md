# City Monitor

Real-time city dashboard, starting with Berlin. Extracts proven patterns from the [worldmonitor](https://github.com/ellie-xyb/worldmonitor) repo into a focused, single-city product.

## Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind v4 + Zustand + React Query
- **Backend:** Node + Express, single process with `node-cron` for scheduled data ingestion
- **Cache:** In-memory Map with TTL (primary), optional Upstash Redis for persistence
- **AI:** OpenAI GPT-5 for news summarization
- **Maps:** MapLibre GL JS with CARTO tiles (free, no API key)
- **Deployment:** Render.com (1 web service + 1 static site)
- **Monorepo:** Turborepo

## Project Structure

```
packages/
  web/          — React SPA (Vite, port 5173)
  server/       — Express API (port 3001)
shared/         — Shared TypeScript types
.worldmonitor/  — Reference copy of worldmonitor (gitignored, delete after all milestones)
.plans/         — Milestone plans (version-tracked)
.context/       — Context files for Claude Code
```

## Architecture

The server runs cron jobs that fetch external data, classify/process it, and write to an in-memory cache. The React SPA reads pre-built JSON via REST endpoints. A bootstrap endpoint (`GET /api/:city/bootstrap`) returns all city data in one response for fast initial load.

Adding a city = adding a config file + setting `ACTIVE_CITIES` env var.

## Milestone Plans

Plans live in `.plans/` and are version-tracked. MVP = milestones 01-05 (scaffolding → news UI). The `.worldmonitor/` directory is the reference for porting patterns — each plan references specific files in it.

## Context Files

- [`.context/licensing.md`](.context/licensing.md) — Every file must have the correct attribution header depending on whether it adapts worldmonitor code or is entirely new. Details the AGPL-3.0 per-file header templates, the full list of adapted components, and Section 13 footer requirements.

## Key Conventions

- **No mandatory Redis** — in-memory cache is primary; Redis is optional for production persistence
- **No SSR** — Vite SPA; dashboard content is client-rendered
- **No WebSocket/SSE** — React Query polling; cron-driven data doesn't change fast enough
- **No auth** — public dashboards with public data
- **package.json** in every package must have `"license": "AGPL-3.0-or-later"`

## Dev Commands

```bash
npm run dev        # Start both web and server via Turborepo
npm run build      # Production build
npm run typecheck  # Type-check all packages
npm run lint       # Lint all packages
```

## Repository

- **Remote:** https://github.com/OdinMB/city-monitor
- **Main branch:** main
- **License:** AGPL-3.0-or-later (dual copyright — see LICENSE)
