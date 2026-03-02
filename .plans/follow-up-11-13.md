# Follow-Up: Milestones 11–13

## User Input Needed

- **Sentry DSN**: M11/M13 — Sentry is optional. To enable it, create a project at sentry.io and set `SENTRY_DSN` in both `.env` files (server + web). The `render.yaml` already has a placeholder for it (`sync: false` means you set it manually in the Render dashboard).

- **Render API URL**: The `render.yaml` static site rewrites `/api/*` to `https://city-monitor-api.onrender.com/api/*`. If you change the API service name on Render, update this URL accordingly.

- **Custom domain**: After deploying, add your domain in Render dashboard → Static Site → Settings → Custom Domain. Render auto-provisions TLS.

- **ACTIVE_CITIES**: Currently set to `berlin` in `render.yaml`. To enable Hamburg, change to `berlin,hamburg` in the Render dashboard environment variables.

## DB Migrations

- **Schema indices (M11)**: Added 5 indices to `schema.ts` (`weather_city_idx`, `transit_city_idx`, `events_city_date_idx`, `safety_city_published_idx`, `summaries_city_generated_idx`). Run `npm run db:generate` and `npm run db:migrate` in `packages/server` to apply locally. On Render, migrations run automatically on each deploy (part of the start command).

## Files to Be Deleted

_None._

## Implementation Issues

_None._
