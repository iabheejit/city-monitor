# Social Atlas 2023 — Map Overlay + Dashboard Tile

## Overview

Add a "Social Atlas 2023" feature with two UI surfaces:
1. **Map choropleth** — 536 Planungsräume (planning areas) colored by composite social status index, with hover popups showing all 5 indicators
2. **Dashboard tile** — 2 headline numbers summarizing Berlin-wide social/economic status

## Data Source

**Monitoring Soziale Stadtentwicklung (MSS) 2023** — Berlin Senate WFS

- **WFS endpoint:** `https://gdi.berlin.de/services/wfs/mss_2023`
- **License:** dl-de-zero-2.0 (free, no attribution required)
- **Data period:** 2020–2022 observation, published 2023
- **Granularity:** 536 valid Planungsräume (smallest LOR unit)

Two WFS layers are needed:

| Layer | Purpose | Key fields |
|-------|---------|------------|
| `mss2023_indexind_542` | Raw indicator values | `s1` (unemployment %), `s2` (single-parent %), `s3` (welfare %), `s4` (child poverty %), `plr_id`, `plr_name`, `bez_id`, `ew` (population), geometry |
| `mss2023_indizes_542` | Composite index | `si_n` (status index 1–4), `si_v` (verbal label), `plr_id` |

Both return GeoJSON with `MultiPolygon` geometry when `outputFormat=application/json&srsName=EPSG:4326`.

## Design Decisions

### Map Layer
- **Default coloring:** Composite Status Index (`si_n`, 1–4 scale) → 4-color diverging ramp
  - 1 = hoch (high social status) → green
  - 2 = mittel (medium) → yellow/amber
  - 3 = niedrig (low) → orange
  - 4 = sehr niedrig (very low) → red
- **Hover popup:** Shows neighborhood name + all 5 values:
  - Composite status label (e.g., "Status: niedrig")
  - Unemployment rate (S1)
  - Single-parent households (S2)
  - Welfare recipients (S3)
  - Child poverty (S4)
- **Layer name in sidebar:** "Social Atlas 2023" (explicit year to avoid implying live data)
- **Berlin-only** (like rent-map) — gated by `cities: ['berlin']` in LAYER_META

### Dashboard Tile
- **2 headline numbers**, derived from the MSS data (population-weighted city averages):
  1. Berlin-wide unemployment rate (population-weighted avg of S1)
  2. Berlin-wide welfare recipients rate (population-weighted avg of S3)
- **Tile title:** "Social Atlas 2023"
- **span={1}**, non-expandable — compact like WaterLevelStrip

### Performance
- ~536 features with polygon geometry ≈ 500KB–1MB uncompressed
- **Not included in bootstrap** — too large for initial load
- GeoJSON fetched on-demand via dedicated hook (lazy: only when layer is toggled or tile needs data)
- Summary stats computed server-side and cached separately → included in bootstrap for the tile

## Architecture: Cache-only, no DB

Like AEDs: the data is static (biennial), so no Postgres table needed. Server fetches WFS weekly, caches with 7-day TTL.

Two cache keys per city:
- `${cityId}:social-atlas:geojson` — full GeoJSON FeatureCollection (for map)
- `${cityId}:social-atlas:summary` — `{ avgUnemployment, avgWelfare, areasLowStatus, totalAreas }` (for tile + bootstrap)

## Implementation Plan

### 1. Shared types (`shared/types.ts`)

```ts
export interface SocialAtlasFeatureProps {
  plrId: string;
  plrName: string;
  bezId: string;
  population: number;
  statusIndex: number;       // si_n: 1–4
  statusLabel: string;       // si_v: "hoch" | "mittel" | "niedrig" | "sehr niedrig"
  unemployment: number;      // s1: %
  singleParent: number;      // s2: %
  welfare: number;           // s3: %
  childPoverty: number;      // s4: %
}

export interface SocialAtlasSummary {
  avgUnemployment: number;
  avgWelfare: number;
  areasLowStatus: number;    // count where si_n >= 3
  totalAreas: number;
  dataYear: string;          // "2023"
}

// CityDataSources addition:
socialAtlas?: { provider: 'mss-wfs'; wfsUrl: string };
```

### 2. Server: Cron job (`packages/server/src/cron/ingest-social-atlas.ts`)

- Factory: `createSocialAtlasIngestion(cache)` → `async () => void`
- For each active city with `dataSources.socialAtlas`:
  1. Fetch `mss2023_indexind_542` as GeoJSON (full dataset, ~536 features)
  2. Fetch `mss2023_indizes_542` as GeoJSON (composite indices)
  3. Join on `plr_id` — merge `si_n`, `si_v` into the indicator features
  4. Filter to valid features only (`kom === 'gultig'`)
  5. Slim properties to `SocialAtlasFeatureProps` (drop raw `_ag_gr`/`_sd_gr` fields)
  6. Compute summary: population-weighted avg of S1/S3, count areas where si_n ≥ 3
  7. `cache.set('berlin:social-atlas:geojson', geojson, 604800)` (7 days)
  8. `cache.set('berlin:social-atlas:summary', summary, 604800)`
- Schedule: `'0 5 * * 0'` (weekly, Sunday 5 AM), `runOnStart: true`

### 3. Server: Route (`packages/server/src/routes/social-atlas.ts`)

Two endpoints:
- `GET /:city/social-atlas` — returns full GeoJSON (for map layer)
- `GET /:city/social-atlas/summary` — returns `SocialAtlasSummary` (for tile)

Cache-Control: `43200` (12 hours)

### 4. Server: Wire up (`packages/server/src/app.ts`)

- Import + create ingestion + create router
- Add cron job to `jobs[]`
- Mount router: `app.use('/api', cacheFor(43200), createSocialAtlasRouter(cache))`
- Add summary to bootstrap: `${city.id}:social-atlas:summary` in `getBatch` + response

### 5. Server: City config (`packages/server/src/config/cities/berlin.ts`)

Add to `dataSources`:
```ts
socialAtlas: { provider: 'mss-wfs', wfsUrl: 'https://gdi.berlin.de/services/wfs/mss_2023' }
```

### 6. Frontend: API + types (`packages/web/src/lib/api.ts`)

- Add `SocialAtlasGeoJSON` type (GeoJSON FeatureCollection)
- Add `SocialAtlasSummary` to imports
- Add `getSocialAtlas` and `getSocialAtlasSummary` to `api` object
- Add `socialAtlasSummary` to `BootstrapData`

### 7. Frontend: Hooks

**`useSocialAtlasSummary.ts`** — always fetches (lightweight, ~100 bytes):
- queryKey: `['social-atlas-summary', cityId]`
- Pre-populated from bootstrap

**`useSocialAtlas.ts`** — fetches the full GeoJSON (heavy, ~500KB):
- queryKey: `['social-atlas', cityId]`
- Long staleTime (12h), long gcTime (24h)
- NOT pre-populated from bootstrap

### 8. Frontend: Map layer (`CityMap.tsx`)

- Add `'social-atlas'` to `DataLayer` union in `useCommandCenter.ts`
- Add to `LAYER_META` in `DataLayerToggles.tsx`: `{ layer: 'social-atlas', icon: BarChart3, color: '#8b5cf6', cities: ['berlin'] }`
- In `CityMap.tsx`:
  - New `updateSocialAtlasLayer(map, geojson, isDark)`:
    - Source: `social-atlas-areas`
    - Fill layer: `social-atlas-fill` — color by `statusIndex` using MapLibre `match` expression (4 colors)
    - Line layer: `social-atlas-line` — thin border for area outlines
    - Popup: HTML showing area name + all 5 indicators
  - `useEffect` gated on `activeLayers.has('social-atlas')` — only calls `useSocialAtlas` when active
  - Add layer IDs to `simplifyMap` exclusion list

### 9. Frontend: Dashboard tile

**`SocialAtlasStrip.tsx`:**
- Uses `useSocialAtlasSummary(cityId)`
- Two numbers:
  1. Unemployment rate: bold number + "%" + label "Unemployment (SGB II)"
  2. Areas count: "X of Y areas" + label "with low social status"

**`CommandLayout.tsx`:**
```tsx
<Tile title={t('panel.socialAtlas.title')} span={1}>
  <SocialAtlasStrip />
</Tile>
```

### 10. i18n (all 4 language files)

```json
"panel": {
  "socialAtlas": {
    "title": "Social Atlas 2023",
    "unemployment": "Unemployment (SGB II)",
    "areasLow": "{{count}} of {{total}} areas with low social status",
    "empty": "No data available",
    "status": {
      "hoch": "High",
      "mittel": "Medium",
      "niedrig": "Low",
      "sehrNiedrig": "Very Low"
    },
    "indicators": {
      "unemployment": "Unemployment",
      "singleParent": "Single-parent households",
      "welfare": "Welfare recipients",
      "childPoverty": "Child poverty"
    }
  }
},
"sidebar": {
  "layers": {
    "social-atlas": "Social Atlas 2023"
  }
}
```

### 11. Context file + CLAUDE.md reference

Create `.context/social-atlas.md` documenting the MSS WFS integration.

## Files to create

| File | Purpose |
|------|---------|
| `packages/server/src/cron/ingest-social-atlas.ts` | WFS fetch + transform + cache |
| `packages/server/src/cron/ingest-social-atlas.test.ts` | Unit tests |
| `packages/server/src/routes/social-atlas.ts` | REST endpoints |
| `packages/server/src/routes/social-atlas.test.ts` | Route tests |
| `packages/web/src/hooks/useSocialAtlas.ts` | React Query hook (full GeoJSON) |
| `packages/web/src/hooks/useSocialAtlasSummary.ts` | React Query hook (summary) |
| `packages/web/src/components/strips/SocialAtlasStrip.tsx` | Dashboard tile |

## Files to modify

| File | Change |
|------|--------|
| `shared/types.ts` | Add `SocialAtlasFeatureProps`, `SocialAtlasSummary`, `CityDataSources.socialAtlas` |
| `packages/server/src/app.ts` | Import + wire cron + mount route |
| `packages/server/src/routes/news.ts` | Add summary to bootstrap `getBatch` + response |
| `packages/server/src/config/cities/berlin.ts` | Add `socialAtlas` to `dataSources` |
| `packages/web/src/lib/api.ts` | Add types, API methods, `BootstrapData.socialAtlasSummary` |
| `packages/web/src/hooks/useBootstrap.ts` | Seed `social-atlas-summary` from bootstrap |
| `packages/web/src/hooks/useCommandCenter.ts` | Add `'social-atlas'` to `DataLayer` |
| `packages/web/src/components/sidebar/DataLayerToggles.tsx` | Add to `LAYER_META` |
| `packages/web/src/components/map/CityMap.tsx` | Add choropleth layer + popup |
| `packages/web/src/components/layout/CommandLayout.tsx` | Add tile |
| `packages/web/src/i18n/en.json` | Add translation keys |
| `packages/web/src/i18n/de.json` | Add German translations |
| `packages/web/src/i18n/tr.json` | Add Turkish translations |
| `packages/web/src/i18n/ar.json` | Add Arabic translations |
