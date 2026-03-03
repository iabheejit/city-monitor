# Population Demographics Feature

## Overview

Add Berlin population demographics from the semi-annual EWR (Einwohnerregisterstatistik) CSV published by Amt für Statistik Berlin-Brandenburg. Two surfaces:

1. **Map choropleths** — 3 new socioeconomic sub-layers: population density, elderly share (% 65+), foreign population share
2. **Dashboard tile** — expandable tile: collapsed shows total + trend, expanded shows age/migration breakdown

## Data Source

- **Provider**: Amt für Statistik Berlin-Brandenburg (CC-BY)
- **File**: `SB_A01-16-00_{YYYY}h{01|02}_BE.xlsx` — Statistical Report "Einwohnerbestand in Berlin – LOR-Planungsräume"
- **Base URL**: `https://download.statistik-berlin-brandenburg.de/` (hashed paths, URL must be scraped from the publication page)
- **Latest verified URL**: `https://download.statistik-berlin-brandenburg.de/1df9da7ea6dbfa3a/f6ac408f14cd/SB_A01-16-00_2025h02_BE.xlsx` (Dec 2025 data, 725KB)
- **Update frequency**: Semi-annual (Jun 30 = h01, Dec 31 = h02; published ~3 months later)
- **Granularity**: 536 LOR Planungsräume (4-column geographic ID: BEZ+PGR+BZR+PLR)

**Important**: The old CSV URLs (`/opendata/EWR_L21_*_Matrix.csv`) are broken — the site migrated to a Scrivito SPA that returns HTML for all `/opendata/` paths. The XLSX files on the `download.` subdomain work and contain more comprehensive data.

### XLSX Structure (verified via spike)

| Sheet | Contents | Key Columns |
|-------|----------|-------------|
| **Schlüssel** | PLR name lookup | BEZ, PGR, BZR, PLR, Planungsraumname |
| **T1** | Population with migration background | total, migration%, Germans, foreigners |
| **T2** | Population by age groups | total, under6, 6-15, 15-18, 18-27, 27-45, 45-55, 55-65, 65+, female, foreigners |
| **T3** | Migration background by age groups | same columns as T2 but for migration population |
| **T4** | Migration by origin country | detailed origin breakdown |

**Number format**: Spaces as thousands separators (` 3 469` = 3469), commas for decimals.
**Dependency**: Needs `xlsx` (SheetJS) npm package for parsing.

## Architecture Decision

### Option A: Full GeoJSON (Recommended)

Population cron produces a complete GeoJSON FeatureCollection with geometry + properties. Geometry is read from the social atlas cache (primary) or fetched from Berlin's LOR WFS (fallback).

- **Pro**: Independent endpoint, proven pattern, simple frontend, no coupling
- **Con**: ~500KB duplicate geometry in cache (same PLR polygons as social atlas)

### Option B: Flat JSON + client-side merge

Population endpoint returns `{ [plrId]: metrics }` (~30KB). Frontend merges onto social atlas geometry.

- **Pro**: Smaller payload, no geometry duplication
- **Con**: Population requires social atlas GeoJSON loaded first, complex client merge, coupling

**Decision**: Option A — follows the proven social atlas pattern. 500KB cached once is negligible cost. Independence means each feature works regardless of the other's status.

## Shared Types

```typescript
// shared/types.ts
export interface PopulationFeatureProps {
  plrId: string;
  plrName: string;
  population: number;       // total residents
  density: number;          // people per km²
  foreignPct: number;       // % non-German nationality
  elderlyPct: number;       // % aged 65+
  youthPct: number;         // % aged 0-17
}

export interface PopulationSummary {
  total: number;
  foreignTotal: number;
  foreignPct: number;
  elderlyPct: number;
  youthPct: number;
  workingAgePct: number;    // % aged 18-64
  changeAbsolute: number;   // vs previous snapshot (0 if first)
  changePct: number;
  snapshotDate: string;     // "2024-12-31"
}
```

## Implementation Steps

### Step 1 — Shared types + cache keys + DB schema

**Files to modify**:
- `shared/types.ts` — add `PopulationFeatureProps`, `PopulationSummary`
- `packages/server/src/lib/cache-keys.ts` — add `populationGeojson(cityId)`, `populationSummary(cityId)`, add `populationSummary` to `bootstrapKeys`
- `packages/server/src/db/schema.ts` — add `populationSnapshots` table (id, cityId, geojson JSONB, summary JSONB, fetchedAt)
- `packages/server/src/db/writes.ts` — add `savePopulation(db, cityId, geojson, summary)`
- `packages/server/src/db/reads.ts` — add `loadPopulationGeojson(db, cityId)`, `loadPopulationSummary(db, cityId)`
- `packages/web/src/lib/api.ts` — re-export new types, add `api.getPopulation(city)`, `api.getPopulationSummary(city)`, extend `BootstrapData`

### Step 2 — Server cron job

**File to create**: `packages/server/src/cron/ingest-population.ts`

Factory: `createPopulationIngestion(cache, db)` → `async function ingestPopulation()`

Flow:
1. Fetch XLSX from `download.statistik-berlin-brandenburg.de` with 60s timeout
2. Parse with `xlsx` (SheetJS): read sheets T2 (age groups) and Schlüssel (PLR names)
3. Parse T2 data rows: strip space thousands separators, extract per-PLR metrics
4. Identify PLR rows by checking that all 4 geo columns (BEZ, PGR, BZR, PLR) are filled numeric values (aggregation rows have text headers like "Mitte")
5. For each PLR from T2: total, youthCount (under6 + 6-15 + 15-18), elderlyCount (65+), foreignCount
6. From Schlüssel: build plrId → plrName lookup
7. Read PLR geometry from social atlas cache (`CK.socialAtlasGeojson(cityId)`) — extract `plrId` → geometry map
8. Fallback: if no cached geometry, fetch from Berlin LOR WFS
9. Compute density: geodetic polygon area via Shoelace formula with latitude correction (no turf.js needed)
10. Build GeoJSON FeatureCollection with `PopulationFeatureProps` on each feature
11. Aggregate city-wide `PopulationSummary` (sum totals, compute weighted %)
12. Compare with previous DB snapshot for change calculation
13. Cache: `CK.populationGeojson(cityId)` with 30-day TTL, `CK.populationSummary(cityId)` with 30-day TTL
14. DB: `savePopulation(db, cityId, geojson, summary)`

Schedule: `0 6 1 * *` (1st of each month at 6 AM — data is semi-annual but we check monthly to catch new releases)
Freshness: `maxAgeSeconds: 2592000` (30 days)
New dependency: `xlsx` (SheetJS) in `packages/server/package.json`

### Step 3 — Server REST endpoints

**File to create**: `packages/server/src/routes/population.ts`

Two endpoints on one router:
- `GET /api/:city/population` → GeoJSON FeatureCollection (~500KB, Cache-Control: 12h)
- `GET /api/:city/population-summary` → PopulationSummary (~200B, Cache-Control: 12h)

Both follow the 3-tier pattern: cache → DB fallback → null response.

**Files to modify**:
- `packages/server/src/app.ts`:
  - Import + instantiate `createPopulationIngestion`
  - Add `FRESHNESS_SPECS` entry
  - Register cron job
  - Mount router with `cacheFor(43200)`
- `packages/server/src/db/warm-cache.ts`:
  - Add population warming in the Berlin-only block (both geojson + summary)
- Bootstrap: add `populationSummary` key to the bootstrap batch read + response shape in `routes/news.ts`

### Step 4 — Frontend hooks + Zustand

**Files to create**:
- `packages/web/src/hooks/usePopulation.ts` — fetches GeoJSON, `enabled` when any population sub-layer active, refetchInterval 24h, gcTime 48h
- `packages/web/src/hooks/usePopulationSummary.ts` — fetches summary for tile, always enabled for Berlin

**Files to modify**:
- `packages/web/src/hooks/useCommandCenter.ts`:
  - Extend: `SocioeconomicLayer = 'social-atlas' | 'rent' | 'pop-density' | 'pop-elderly' | 'pop-foreign'`
- `packages/web/src/hooks/useBootstrap.ts`:
  - Add `populationSummary` seeding line

### Step 5 — Sidebar sub-layers

**File to modify**: `packages/web/src/components/sidebar/DataLayerToggles.tsx`

Add 3 entries to `SOCIOECONOMIC_SUB_META`:
```
{ key: 'pop-density',  icon: Users,     color: '#3b82f6' }  // blue
{ key: 'pop-elderly',  icon: UserRound,  color: '#f59e0b' }  // amber
{ key: 'pop-foreign',  icon: Globe,      color: '#06b6d4' }  // cyan
```

Import `Users`, `UserRound`, `Globe` from lucide.

### Step 6 — Map choropleth rendering

**File to modify**: `packages/web/src/components/map/CityMap.tsx`

New function: `updatePopulationLayer(map, geojson, metric, isDark)`
- Source ID: `population-areas`
- Fill layer: `population-fill`
- Line layer: `population-line`
- Color paint: `interpolate` expression on the selected metric property with appropriate stops:
  - `pop-density`: sequential blue ramp (0 → light blue, 30000 → dark blue)
  - `pop-elderly`: sequential amber ramp (0% → light amber, 40% → dark amber)
  - `pop-foreign`: sequential cyan ramp (0% → light cyan, 50% → dark cyan)
- Popup (same for all 3): show PLR name + all metrics (population, density, foreign%, elderly%, youth%)
- Layer exemption: add `population-` prefix to `simplifyMap()` filter

Reactive wiring:
- Derive `populationActive = socioeconomicActive && socioeconomicLayer.startsWith('pop-')`
- Derive `populationMetric` from `socioeconomicLayer` (strip `pop-` prefix)
- `usePopulation(cityId, populationActive)` for data
- `useEffect` on `[populationGeoJson, socioeconomicLayer]` to call `updatePopulationLayer()`
- Ensure social atlas layer is torn down when population is active and vice versa

### Step 7 — Dashboard tile

**File to create**: `packages/web/src/components/strips/PopulationStrip.tsx`

Expandable tile following wastewater pattern:

**Collapsed**:
- Total population formatted with locale (e.g., "3,913,644")
- Semester-over-semester change badge: "+16,499 (+0.4%)" with green/red color

**Expanded**:
- Total population + change (same as collapsed, prominent)
- Horizontal stacked bar: youth% | working-age% | elderly%
- Foreign population: "24.8% foreign nationality"
- Data source footnote: "Amt für Statistik, Dec 31, 2024"

**File to modify**: `packages/web/src/components/layout/CommandLayout.tsx`
- Add `PopulationStrip` tile in Berlin-only block, after labor market:
  ```tsx
  {cityId === 'berlin' && (
    <Tile title={t('panel.population.title')} span={1} expandable defaultExpanded={isDesktop}>
      {(expanded) => <PopulationStrip expanded={expanded} />}
    </Tile>
  )}
  ```

### Step 8 — i18n (all 4 locales)

**Files to modify**: `en.json`, `de.json`, `tr.json`, `ar.json`

Keys:
```json
"sidebar.socioeconomic.pop-density": "Population Density"
"sidebar.socioeconomic.pop-elderly": "Elderly Share"
"sidebar.socioeconomic.pop-foreign": "Foreign Population"
"panel.population.title": "Population"
"panel.population.total": "Total"
"panel.population.foreign": "Foreign nationality"
"panel.population.elderly": "Aged 65+"
"panel.population.youth": "Under 18"
"panel.population.workingAge": "Working age"
"panel.population.change": "vs. previous half-year"
"panel.population.empty": "No data available"
"panel.population.source": "Statistik Berlin-Brandenburg"
"panel.population.density": "per km²"
```

### Step 9 — Context + documentation

- Create `.context/population.md` — data source, CSV format, cron schedule, cache keys, endpoint shapes
- Update `CLAUDE.md` — add reference to new context file

### Step 10 — Tests

- Unit test for CSV parsing logic (mock CSV text → expected per-PLR metrics)
- Unit test for geodetic area calculation
- Unit test for summary aggregation
- Integration test for REST endpoints (mock cache/DB)

## Files Summary

| Action | File |
|--------|------|
| Modify | `shared/types.ts` |
| Modify | `packages/server/src/lib/cache-keys.ts` |
| Modify | `packages/server/src/db/schema.ts` |
| Modify | `packages/server/src/db/writes.ts` |
| Modify | `packages/server/src/db/reads.ts` |
| Modify | `packages/server/src/db/warm-cache.ts` |
| Modify | `packages/server/src/app.ts` |
| Create | `packages/server/src/cron/ingest-population.ts` |
| Create | `packages/server/src/routes/population.ts` |
| Modify | `packages/server/src/routes/news.ts` (bootstrap) |
| Modify | `packages/web/src/lib/api.ts` |
| Modify | `packages/web/src/hooks/useCommandCenter.ts` |
| Create | `packages/web/src/hooks/usePopulation.ts` |
| Create | `packages/web/src/hooks/usePopulationSummary.ts` |
| Modify | `packages/web/src/hooks/useBootstrap.ts` |
| Modify | `packages/web/src/components/sidebar/DataLayerToggles.tsx` |
| Modify | `packages/web/src/components/map/CityMap.tsx` |
| Create | `packages/web/src/components/strips/PopulationStrip.tsx` |
| Modify | `packages/web/src/components/layout/CommandLayout.tsx` |
| Modify | `packages/web/src/i18n/{en,de,tr,ar}.json` |
| Create | `.context/population.md` |
| Modify | `CLAUDE.md` |

## Design Decisions (confirmed)

1. **5 flat radio buttons** under socioeconomic — no nested grouping
2. **Spike CSV first** — verify URL, format, column structure before building the full parser
3. **Stacked bar + text** in the dashboard tile — visual age breakdown bar plus key numbers

## Risks

1. **~~CSV URL broken~~** — RESOLVED: CSV URLs serve HTML due to SPA migration. Using XLSX from `download.` subdomain instead. Verified working.
2. **~~CSV column structure unknown~~** — RESOLVED: XLSX T2 sheet structure fully verified via spike. Clean tabular format.
3. **XLSX URL is hashed** — The download URL contains hash segments (`/1df9da7ea6dbfa3a/f6ac408f14cd/`) that may change when the file is updated. The cron job should either hardcode the known URL and update it manually each semester, or scrape the publication page to discover the latest URL. Start with hardcoded URL; add scraping later if needed.
4. **LOR WFS fallback URL** — need to verify exact URL for Berlin LOR Planungsräume geometry WFS as fallback for when social atlas isn't cached.
5. **No previous snapshot for change calculation** — first ingestion will show change as 0. Subsequent runs compare against the previous DB snapshot.
6. **New dependency** — `xlsx` (SheetJS) adds ~2MB to server bundle. Acceptable for a build-time dependency.
