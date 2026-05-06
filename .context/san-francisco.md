# San Francisco City Integration

San Francisco (city ID: `san-francisco`) is a US city added alongside Berlin, Hamburg, and Nagpur.

## City Config

- **Server**: `packages/server/src/config/cities/san-francisco.ts`
- **Web**: `packages/web/src/config/cities/san-francisco.ts`
- `country: 'US'`, `timezone: 'America/Los_Angeles'`
- Accent color: `#E8800A` (Golden Gate orange)
- Languages: `['en', 'es', 'zh']`
- 5 RSS news feeds: SF Chronicle, SF Examiner, SFGate, SFist, KQED

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SF_511_API_KEY` | Yes (transit) | 511 SF Bay API key — register at https://511.org/open-data/token |
| `SF_SOCRATA_APP_TOKEN` | No | DataSF Socrata app token for higher rate limits |

## Data Sources

### 1. SF Public Safety (`sf-safety`)
- **Ingestor**: `packages/server/src/cron/ingest-sf-safety.ts`
- **Route**: `GET /api/:city/sf-safety`
- **Law enforcement**: `https://data.sfgov.org/resource/gnap-fj3t.json` — SFPD dispatch calls, last 24h, limit 500
- **Fire & EMS**: `https://data.sfgov.org/resource/nuek-vuh3.json` — SFFD calls for service, last 24h, limit 500
- **Auth**: Optional `X-App-Token` header from `SF_SOCRATA_APP_TOKEN`
- **Cache TTL**: 600s · **Cron**: `*/10 * * * *`
- **Gate**: `city.country !== 'US'` skips

### 2. SF 311 Requests (`sf-311`)
- **Ingestor**: `packages/server/src/cron/ingest-sf311.ts`
- **Route**: `GET /api/:city/sf-311`
- **Endpoint**: `https://data.sfgov.org/resource/vw6y-z8j6.json` — 311 cases, last 7 days, limit 1000
- **Cache TTL**: 86400s · **Cron**: `0 7 * * *`

### 3. SF Street Closures (`sf-street-closures`)
- **Ingestor**: `packages/server/src/cron/ingest-sf-street-closures.ts`
- **Route**: `GET /api/:city/sf-street-closures`
- **Endpoint**: `https://data.sfgov.org/resource/98cv-qtqk.json` — active closures where `end_date >= today`
- **Cache TTL**: 86400s · **Cron**: `0 6 * * *`

### 4. SF Transit Alerts (`sf-transit-alerts`)
- **Ingestor**: `packages/server/src/cron/ingest-sf-transit.ts`
- **Route**: `GET /api/:city/sf-transit-alerts`
- **Muni (SFMTA)**: `https://api.511.org/transit/servicealerts?api_key=[key]&agency=SF&format=json`
- **BART**: `https://api.511.org/transit/servicealerts?api_key=[key]&agency=BA&format=json`
- **Note**: Uses `?format=json` — no protobuf/gtfs-realtime-bindings dependency
- **Cache TTL**: 900s · **Cron**: `*/15 * * * *`
- **Gate**: Skips (with warning) if no `SF_511_API_KEY`

## Data Shapes

See `shared/types.ts` for:
- `SfDispatchCall`, `SfFireEmsCall`, `SfSafetyData`
- `Sf311Request`, `Sf311Data`
- `SfStreetClosure`, `SfStreetClosuresData`
- `SfTransitAlert`, `SfTransitAlertsData`

Zod schemas in `shared/schemas.ts` follow the same naming.

## Frontend Components

| Component | File |
|---|---|
| `SfSafetyStrip` | `packages/web/src/components/strips/SfSafetyStrip.tsx` |
| `Sf311Strip` | `packages/web/src/components/strips/Sf311Strip.tsx` |
| `SfStreetClosuresStrip` | `packages/web/src/components/strips/SfStreetClosuresStrip.tsx` |
| `SfTransitStrip` | `packages/web/src/components/strips/SfTransitStrip.tsx` |

Hooks: `useSfSafety`, `useSf311`, `useSfStreetClosures`, `useSfTransitAlerts` in `packages/web/src/hooks/`.

## DB Snapshot Types

Added to `SNAPSHOT_TYPES` in `packages/server/src/db/schema.ts`:
- `'sf-safety'`, `'sf-311'`, `'sf-street-closures'`, `'sf-transit-alerts'`

No DB migration needed — `snapshots.type` is a plain `text` column, not a Postgres enum.

## Activating SF

Server: add `san-francisco` to `ACTIVE_CITIES` env var (or set to `berlin,hamburg,nagpur,san-francisco`).  
Web: `san-francisco` is already in `ACTIVE_CITY_IDS` in `packages/web/src/config/index.ts`.
