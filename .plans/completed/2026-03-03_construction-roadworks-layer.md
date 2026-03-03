# Construction / Roadworks Layer

Integrate VIZ Berlin construction/roadworks data as a new map layer and dashboard feature.

## Data Source

- **URL:** `https://api.viz.berlin.de/daten/baustellen_sperrungen.json`
- **Format:** GeoJSON FeatureCollection (Point + LineString + GeometryCollection)
- **Auth:** None
- **License:** dl-de-by-2.0 (attribution: "Digitale Plattform Stadtverkehr Berlin")
- **Updates:** Hourly, editorially curated

## Approach: Cache-Only (like traffic)

Construction data follows the **traffic pattern** — cache-only, no Postgres table. Rationale:
- Data is a full snapshot refreshed hourly (not append-only like news/safety)
- No historical analysis needed
- VIZ endpoint returns the current set; stale data has no value
- Keeps implementation minimal

## Changes

### Server

1. **`shared/types.ts`** — Add `ConstructionSite` interface
2. **`packages/server/src/config/cities/berlin.ts`** — Add `roadworks` to `dataSources`
3. **`shared/types.ts`** — Add `roadworks` to `CityDataSources`
4. **`packages/server/src/cron/ingest-construction.ts`** — New cron job (modeled on `ingest-traffic.ts`): fetch GeoJSON, map features to `ConstructionSite[]`, write to cache
5. **`packages/server/src/routes/construction.ts`** — New route: `GET /:city/construction` (cache-only, no DB fallback)
6. **`packages/server/src/app.ts`** — Wire cron job + route
7. **`packages/server/src/routes/news.ts`** — Add to bootstrap `getBatch()`

### Web

8. **`packages/web/src/lib/api.ts`** — Add `ConstructionSite` type + `api.getConstruction()`
9. **`packages/web/src/hooks/useConstruction.ts`** — New React Query hook (15-min refetch)
10. **`packages/web/src/hooks/useCommandCenter.ts`** — Add `'construction'` to `DataLayer` union
11. **`packages/web/src/components/sidebar/DataLayerToggles.tsx`** — Add entry to `LAYER_META`
12. **`packages/web/src/lib/map-icons.ts`** — Register `construction-icon` (Lucide `Construction` icon, amber color)
13. **`packages/web/src/components/map/CityMap.tsx`** — Add `constructionToGeoJSON()`, `updateConstructionLayers()`, wire into effects + simplifyMap prefix
14. **`packages/web/src/hooks/useBootstrap.ts`** — Seed construction from bootstrap
15. **i18n** — Add `sidebar.layers.construction` in all 4 locale files

### Data Shape

```ts
interface ConstructionSite {
  id: string;
  subtype: 'construction' | 'closure' | 'disruption';
  street: string;
  section?: string;
  description: string;
  direction?: string;
  validFrom?: string;
  validUntil?: string;
  isFuture: boolean;
  geometry: GeoJSON.Geometry;
}
```

**Filtering:** Exclude `subtype === 'Unfall'` (accidents) from VIZ data — TomTom traffic already covers those.

**No dashboard tile** — map layer + sidebar toggle only.

### Map Rendering

- **Lines:** Amber/orange line with dark casing (like traffic) for LineString geometries
- **Points:** Construction icon marker for Point geometries
- Subtype-based coloring: construction=amber, closure=red, disruption=orange
- Popup on hover: street, section, description, validity dates

### Cron Schedule

`'*/30 * * * *'` (every 30 minutes) — VIZ updates hourly, so 30min catches each update within half the interval. `runOnStart: true`. Cache TTL: 1800s.
