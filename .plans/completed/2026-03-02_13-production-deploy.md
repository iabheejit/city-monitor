# Milestone 13 — Production Deploy

**Goal:** Deploy to Render.com with proper configuration, monitoring, and CI/CD.

**Depends on:** All feature milestones complete.

---

## Steps

### 1. render.yaml (Blueprint)

```yaml
databases:
  # --- PostgreSQL ---
  - name: city-dashboard-db
    plan: starter              # $7/month, 1GB storage
    region: frankfurt
    databaseName: city_monitor
    user: city_monitor

services:
  # --- API Server ---
  - type: web
    name: city-dashboard-api
    runtime: node
    plan: starter              # $7/month, 512MB RAM
    region: frankfurt           # eu-central for German cities
    buildCommand: npm ci && npm run build --workspace=packages/server
    startCommand: npm run db:migrate --workspace=packages/server && node packages/server/dist/index.js
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: ACTIVE_CITIES
        value: berlin
      - key: DATABASE_URL
        fromDatabase:
          name: city-dashboard-db
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false
      - key: SENTRY_DSN
        sync: false

  # --- Static Frontend ---
  - type: web
    name: city-dashboard-web
    runtime: static
    buildCommand: npm ci && npm run build --workspace=packages/web
    staticPublishPath: packages/web/dist
    headers:
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
      - path: /*
        name: Cache-Control
        value: public, max-age=300
    routes:
      - type: rewrite
        source: /api/*
        destination: https://city-dashboard-api.onrender.com/api/*
      - type: rewrite
        source: /*
        destination: /index.html
```

No separate cron services — the API server runs `node-cron` internally. Migrations run automatically on each deploy via the start command.

### 2. Environment variables

| Variable | Where to get it | Required? |
|---|---|---|
| `DATABASE_URL` | Render dashboard → Postgres → Connection String | Required (auto-set via render.yaml) |
| `OPENAI_API_KEY` | platform.openai.com → API keys | Optional (no AI summaries without it) |
| `SENTRY_DSN` | sentry.io → create project | Optional |
| `ACTIVE_CITIES` | Your config | Required |

### 3. Database setup

Render Postgres is provisioned automatically via `render.yaml`. The `DATABASE_URL` is injected into the API service. Migrations run on each deploy (in the start command).

### 4. Custom domain

1. Register domain (e.g., `citydash.app`)
2. Add to Render static site → Settings → Custom Domain
3. Render auto-provisions TLS via Let's Encrypt
4. For multi-city subdomains: add `*.citydash.app` as a wildcard domain

### 5. CI/CD

Render auto-deploys on push to `main`. Add GitHub Actions for quality gates:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
```

### 6. Monitoring

- **Sentry:** Errors, performance, release tracking
- **Render Dashboard:** CPU, memory, request count, Postgres metrics
- **Health endpoint:** `GET /api/health` — uptime, DB connectivity, cache stats, AI cost tracking

### 7. Alerting

- Render notifies on deploy failures (built-in)
- Sentry alerts on new errors (configure per-project)
- Optional: health check monitor via UptimeRobot (free) or Render's built-in health checks

---

## Done when

- [ ] `render.yaml` deploys both services successfully
- [ ] Static site serves the React SPA
- [ ] API service starts, runs cron jobs, responds to health checks
- [ ] Postgres is connected and migrations applied
- [ ] Custom domain is configured with TLS
- [ ] CI pipeline runs on PRs (typecheck, lint, test)
- [ ] Sentry captures errors from both frontend and server
- [ ] Total monthly cost is under $21 for one city

---

## Post-launch

After launch, delete `.worldmonitor/` — the new codebase is fully standalone.
