# Nagpur Data Sources Tracker

Last updated: 2025-05-01

## Legend
- **Backend**: types + schema + ingestor + route + cache + bootstrap + warm-cache
- **Frontend**: hook + strip component + CommandLayout tile + i18n keys
- **Probe**: LIVE_OK / BROKEN / CSV_STATIC / UNVERIFIED / REQUEST_ONLY

---

## ✅ Fully integrated (backend + frontend visible)

| Source | Probe | Backend | Frontend | Notes |
|--------|-------|---------|----------|-------|
| AGMARKNET mandi prices | LIVE_OK (55) | ✅ | ✅ MandiStrip | Daily commodity prices at Nagpur APMC |
| MGNREGA employment | BROKEN | ✅ | ✅ MgnregaStrip | API resource decommissioned upstream; displays empty state |
| MyScheme catalogue | REQUEST_ONLY | ✅ | ✅ SchemesStrip | Works via specific MyScheme API contract |
| MSME Udyam registrations | LIVE_OK (272k) | ✅ | ✅ MsmeStrip | Total, top sectors, recent registrations |
| CPCB real-time AQI | LIVE_OK (28) | ✅ | ✅ CpcbAqiStrip | Station-level PM2.5 + pollutant breakdown |

---

## 🔧 Backend only (wired, no frontend tile yet)

| Source | Probe | Backend | Notes |
|--------|-------|---------|-------|
| HMIS sub-district maternal | BROKEN | ✅ (not activated in city config) | Resource ID `f7fce53f` returns "Meta not found"; pipeline ready, probe-gated |

---

## ❌ Not integrated — all probed BROKEN (bad resource IDs or decommissioned)

These were probed on 2025-05-01 with guessed resource IDs. All returned `total=0 / Meta not found`.
Need correct resource IDs from data.gov.in catalog search before integration.

| Source | Probe ID used | Status | Priority | Path to fix |
|--------|--------------|--------|----------|-------------|
| Jal Jeevan Mission FHTC | `7db95e3c` + alt `b13a8d16` | BROKEN | High | Find correct resource via data.gov.in catalog search for "JJM FHTC Maharashtra" |
| Swachh Survekshan city scores | `1d5f9578` + alt `a9126f70` | BROKEN | High | Search catalog for "Swachh Survekshan 2023" |
| HMIS district monthly (NHM MH) | `6d9b7f00` + alt `d8e1a76f` | BROKEN | High | Search "HMIS monthly district Maharashtra" |
| Government hospital directory | `a90f5dba` | BROKEN | High | Search "NHA hospital directory Maharashtra" |
| Blood bank directory (NACO) | `fded4f6b` | BROKEN | Medium | Search "blood bank Maharashtra NACO" |
| TB district notifications (NTEP) | `e9042c44` | BROKEN | Medium | Search "TB notifications district 2023" |
| UDISE+ schools Maharashtra | `65ac234b` | BROKEN | Medium | Search "UDISE school district Maharashtra" |
| MGNREGA financial progress MH | `51e7e9d7` | BROKEN | Medium | Search "MGNREGA financial Maharashtra district" |
| e-Shram registrations | `4b8f2a19` | BROKEN | Low | Search "e-Shram district Maharashtra" |
| Smart Cities Mission tracker | `cbf4e9d3` | BROKEN | Low | Search "Smart Cities Nagpur project" |
| PM Vishwakarma registrations | `f3a9c2b7` | BROKEN | Low | Search "PM Vishwakarma district Maharashtra" |

---

## 📋 Sources not on data.gov.in (require other integration approaches)

| Source | Category | Approach needed | Priority |
|--------|----------|----------------|----------|
| WAQI/CPCB AQI (existing) | Air Quality | Already shown in AirQualityStrip via WAQI API | ✅ Done |
| OpenStreetMap / Overpass | Infrastructure | POI queries (hospitals, parks, schools) | Medium |
| Wikipedia / Wikidata | City info | Static enrichment | Low |
| Census 2011 / 2021 | Demographics | CSV static import | Low |
| Maharashtra Budget Portal | Finance | Request-only / PDF | Low |
| Nagpur Municipal Corporation | Civic | No open API; scrape risk | Low |
| GSWAN / Maharashtra GIS | Spatial | WMS/WFS endpoints | Low |
| Railway / IRCTC | Transport | No open public API | Low |
| BEST / city bus routes | Transport | GTFS if available | Medium |
| Nagpur Metro (NMRCL) | Transport | No open API | Low |
| Air quality (Safar) | Environment | No open API | Low |
| COVID data | Health | Archived, not real-time | Skip |
| Election results | Governance | EC website / CSV | Low |

---

## 🔍 How to find correct data.gov.in resource IDs

1. Go to https://data.gov.in/catalog
2. Search for the dataset name
3. Open the dataset page
4. Look for the **resource ID** in the API tab or the URL: `data.gov.in/resource/{UUID}`
5. Add to `probe-data-sources.ts` PROBE_SPECS with appropriate filters
6. Run `DATA_GOV_IN_API_KEY=... npx tsx packages/server/src/scripts/probe-data-sources.ts`
7. If LIVE_OK → implement backend pipeline → activate in city config

## 📐 Integration pattern checklist

For each new source:
- [ ] `shared/types.ts` — interface for the data shape
- [ ] `shared/schemas.ts` — Zod schema
- [ ] `packages/server/src/db/schema.ts` — add to `SNAPSHOT_TYPES`
- [ ] `packages/server/src/db/writes.ts` — `saveX()` function
- [ ] `packages/server/src/db/reads.ts` — `loadX()` function
- [ ] `packages/server/src/lib/cache-keys.ts` — cache key + `bootstrapKeys`
- [ ] `packages/server/src/cron/ingest-X.ts` — ingestion job
- [ ] `packages/server/src/routes/X.ts` — route
- [ ] `packages/server/src/routes/bootstrap.ts` — bootstrap field
- [ ] `packages/server/src/db/warm-cache.ts` — warm-cache call
- [ ] `packages/server/src/app.ts` — wire router + cron
- [ ] `packages/server/src/config/cities/nagpur.ts` — activate in dataSources
- [ ] `packages/web/src/config/cities/nagpur.ts` — activate in dataSources
- [ ] `shared/types.ts` — add `CityDataSources` field
- [ ] `packages/web/src/lib/api.ts` — `api.getX()` method + re-export types
- [ ] `packages/web/src/hooks/useX.ts` — React Query hook
- [ ] `packages/web/src/components/strips/XStrip.tsx` — UI strip
- [ ] `packages/web/src/components/layout/CommandLayout.tsx` — tile
- [ ] All 6 i18n locale files — `panel.x.*` keys
