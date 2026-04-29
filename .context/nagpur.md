# Nagpur — City Monitor Context

Nagpur is the second (winter) capital of Maharashtra, India (~2.7 M population). Geographic centre of India, situated on the Nag and Kanhan rivers. Major agricultural trading hub (APMC Nagpur, Kalamna market). City config ID: `nagpur`, country: `IN`, timezone: `Asia/Kolkata`.

## Configuration

- **Server:** `packages/server/src/config/cities/nagpur.ts`
- **Web:** `packages/web/src/config/cities/nagpur.ts`
- **Accent:** `#FF6600` (saffron-orange, Maharashtra's symbolic colour)
- **Languages:** `['en', 'hi', 'mr']`
- **Map bounds:** `[[78.90, 20.90], [79.30, 21.35]]`, zoom 12

## Data Sources

### Open-Meteo (Weather)
- Works globally; no code change required
- Coords: lat 21.1458, lon 79.0882

### AGMARKNET Mandi Prices
- **Endpoint:** `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Auth:** `DATA_GOV_IN_API_KEY` env var
- **Filters:** `State=Maharashtra`, `District=Nagpur`
- **Data:** commodity, variety, market, min/max/modal price (₹/quintal), arrival_date
- **Frequency:** daily upload; ingested at 04:00 UTC (`0 4 * * *`) = ~09:30 IST
- **Cache TTL:** 43200s (12 h)
- **Snapshot type:** `agmarknet-mandi`
- **Cache key:** `CK.mandi(cityId)`

### MGNREGA Employment
- **Endpoint:** `https://api.data.gov.in/resource/9802de1b-1be5-4c1c-b247-aba9ee9b25d9`
- **Auth:** `DATA_GOV_IN_API_KEY` env var
- **Filters:** `State_code=27` (Maharashtra), `District_code=529` (Nagpur)
- **Data:** financial year, person-days generated, job cards issued, active workers, amount spent (lakhs), sanctioned amount (lakhs)
- **Frequency:** monthly NIC updates; ingested at 07:00 UTC (`0 7 * * *`)
- **Cache TTL:** 86400s (24 h)
- **Snapshot type:** `data-gov-mgnrega`
- **Cache key:** `CK.mgnrega(cityId)`

### MyScheme Government Schemes
- **Endpoint:** `https://api.myscheme.gov.in/search/v4/schemes`
- **Params:** `lang=en`, `beneficiaryState=MH`, `numberOfSchemes=30`
- **Data:** scheme ID, name, ministry, benefit type, description, apply URL, tags
- **Frequency:** rarely changes; ingested at 05:00 UTC (`0 5 * * *`)
- **Cache TTL:** 86400s (24 h)
- **Snapshot type:** `myscheme-schemes`
- **Cache key:** `CK.myScheme(cityId)`

### WAQI / CPCB Air Quality
- Uses existing `ingest-air-quality-grid.ts` — WAQI aggregates CPCB data
- Requires `WAQI_API_TOKEN` env var (same as Berlin/Hamburg)
- No code change needed; works on Nagpur bounding box

### TomTom Traffic
- Works globally via existing `ingest-traffic.ts`
- Uses Nagpur bounding box automatically

### RSS News Feeds
- Ingested by `ingest-feeds.ts` (no code change)
- Feed URLs in `nagpur.ts` server config; may need verification:
  - TOI Nagpur: `https://timesofindia.indiatimes.com/rssfeeds/7503718.cms`
  - HT Nagpur: `https://www.hindustantimes.com/rss/nagpur/rssfeed.xml`
  - Nagpur Today: `https://www.nagpurtoday.in/feed`
  - Lokmat Nagpur: `https://www.lokmat.com/nagpur/feed/`
  - Maharashtra Times: `https://maharashtratimes.com/rss/nagpur.cms`

## Env Vars Required

| Variable | Purpose |
|---|---|
| `DATA_GOV_IN_API_KEY` | AGMARKNET + MGNREGA data.gov.in API |
| `WAQI_API_TOKEN` | Air quality grid (shared with other cities) |
| `TOMTOM_API_KEY` | Traffic incidents (shared with other cities) |
| `OPENAI_API_KEY` | News summarization (shared) |

## What's Omitted (Deferred)

- **Police RSS:** No confirmed Nagpur Police / Maharashtra Police public RSS URL at time of writing. Omit `police` from config; SafetyStrip renders nothing.
- **Transit:** Nagpur Metro (Maha-Metro) has no public GTFS/HAFAS API. `transit` omitted.
- **NINA/DWD:** Already gated on `city.country === 'DE'`; auto-skipped.
- **Pollen:** DWD data is Germany-only; `pollen` omitted from config.
- **PEGELONLINE water levels:** Germany-only gauge network; `waterLevels` omitted.
- **Map district GeoJSON:** NMC ward boundaries not yet bundled. `DISTRICT_URLS['nagpur']` not registered — political/choropleth layer is unavailable.

## Frontend Components

| Component | File |
|---|---|
| `MandiStrip` | `packages/web/src/components/strips/MandiStrip.tsx` |
| `MgnregaStrip` | `packages/web/src/components/strips/MgnregaStrip.tsx` |
| `SchemesStrip` | `packages/web/src/components/strips/SchemesStrip.tsx` |
| `useMandiPrices` | `packages/web/src/hooks/useMandiPrices.ts` |
| `useMgnrega` | `packages/web/src/hooks/useMgnrega.ts` |
| `useMyScheme` | `packages/web/src/hooks/useMyScheme.ts` |

All three strips are conditionally rendered in `CommandLayout.tsx` based on `dataSources.agmarknet`, `dataSources.mgnrega`, and `dataSources.myScheme` respectively.

## i18n

New locale files: `packages/web/src/i18n/hi.json` (Hindi) and `packages/web/src/i18n/mr.json` (Marathi). Both registered in `packages/web/src/i18n/index.ts`. Language switcher automatically shows HI/MR buttons for Nagpur because the city config has `languages: ['en', 'hi', 'mr']`.

New i18n keys: `panel.mandi.*`, `panel.mgnrega.*`, `panel.schemes.*` — added to all 6 locale files (en, de, tr, ar, hi, mr).

## Deployment

To activate Nagpur in production:
1. Set `ACTIVE_CITIES=berlin,hamburg,nagpur` (or whichever subset) in Render env vars
2. Add `DATA_GOV_IN_API_KEY` secret in Render
3. Run `npm run db:migrate` (new snapshot types: `agmarknet-mandi`, `data-gov-mgnrega`, `myscheme-schemes`)
