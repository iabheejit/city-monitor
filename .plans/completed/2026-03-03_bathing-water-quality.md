# Bathing Water Quality Layer

Add a Berlin bathing water quality map layer showing the 39 official bathing spots monitored by LAGeSo with water quality ratings, temperature, algae warnings, and visibility data.

## Data Source

**LAGeSo CSV endpoint** — `https://data.lageso.de/baden/0_letzte/letzte.csv`

- **39 bathing spots** with coordinates, quality ratings, water temperature, E.coli/enterococci levels, algae warnings, visibility depth
- **Auth:** None. Free public data.
- **Update frequency:** Every 2 weeks during bathing season (May 15 – Sep 15). Off-season the CSV still returns the last measurements from the previous season.
- **Format:** Semicolon-delimited CSV, UTF-8

### Key CSV fields

| Field | Example | Description |
|---|---|---|
| `BadName` | `Strandbad Wannsee` | Bathing spot name |
| `Bezirk` | `Steglitz-Zehlendorf` | District |
| `Profil` | `Unterhavel` | Water body group |
| `Latitude` / `Longitude` | `52.438898` / `13.176804` | Coordinates (WGS84) |
| `Dat` | `16.09.2025` | Date of last measurement |
| `Sicht` | `1` | Visibility depth (meters) |
| `Eco` | `<15` | E.coli (MPN/100ml) — may have `<` prefix |
| `Ente` | `<15` | Enterococci (MPN/100ml) — may have `<` prefix |
| `Temp` | `18.7` | Water temperature (°C) |
| `Farb_ID` | `1` | Quality code: 1=good (green), 3=warning (yellow), 5=poor (red) |
| `Wasserqualitaet` | `1` | Quality rating number |
| `Algen` | `Blaualgenmassenentwicklungen` | Algae type if present, `NA` or `keine` = none |
| `Bemerkung` | `keine` | Remark/warning text |
| `Weitere_Hinweise` | `Blaualgenmassenentwicklungen…` | Additional advisory |
| `Farbe` | `gruen.jpg` / `gelb.jpg` | Color code for quality badge |
| `classification` | `ausgezeichnet` / `gut` | EU quality classification |
| `BadestelleLink` | full URL | Link to official detail page |

## Architecture

**Cache-only pattern** (same as AEDs). No Postgres table — the data changes at most every 2 weeks and is small (39 rows). A daily cron refresh is sufficient.

### Why cache-only
- Only 39 items, ~10 KB after parsing
- Updates biweekly during season, never off-season
- No historical analysis needed
- Server restarts recover instantly via `runOnStart: true`

## Implementation

### 1. Shared type (`shared/types.ts`)

```typescript
export interface BathingSpot {
  id: string;                // "bath-{BSL}" using the BSL station code
  name: string;              // BadName
  district: string;          // Bezirk
  waterBody: string;         // Profil (lake/river group name)
  lat: number;
  lon: number;
  measuredAt: string;        // ISO date from Dat field
  waterTemp: number | null;  // °C
  visibility: number | null; // meters
  quality: 'good' | 'warning' | 'poor';  // derived from Farb_ID
  algae: string | null;      // null if "keine" or "NA"
  advisory: string | null;   // Weitere_Hinweise (null if "keine")
  classification: string | null;  // EU classification (ausgezeichnet/gut/etc)
  detailUrl: string;         // BadestelleLink
}
```

### 2. Server cron (`packages/server/src/cron/ingest-bathing.ts`)

- Factory: `createBathingIngestion(cache)` — cache-only, no `db` needed
- Schedule: `0 6 * * *` (daily at 6 AM) with `runOnStart: true`
- Berlin-only (no Hamburg equivalent exists)
- Fetch CSV, parse with semicolon delimiter, map to `BathingSpot[]`
- Cache key: `berlin:bathing:spots` with 24h TTL
- CSV parsing: split by `;`, handle `<` prefixes in numeric fields, parse German dates (DD.MM.YYYY)
- Quality mapping: `Farb_ID` 1 → `good`, 3/13 → `warning`, 5 → `poor` (13 = warning+forecast)
- Skip `Farb_ID` values 11 (good+forecast) → still map to `good`

### 3. Server route (`packages/server/src/routes/bathing.ts`)

- `GET /api/:city/bathing` → returns `BathingSpot[]`
- Cache-only read, empty array fallback
- `cacheFor(43200)` (12h HTTP cache)

### 4. App wiring (`packages/server/src/app.ts`)

- Import + instantiate cron job
- Import + mount route
- Add to scheduler array

### 5. Frontend API (`packages/web/src/lib/api.ts`)

- Re-export `BathingSpot` from shared
- Add `getBathing` method

### 6. Frontend hook (`packages/web/src/hooks/useBathing.ts`)

- `useQuery` with 24h refetch, 12h staleTime (matches AED pattern)
- Query key: `['bathing', cityId]`

### 7. Map layer (`packages/web/src/components/map/CityMap.tsx`)

- New `updateBathingMarkers` function
- Icon: Lucide `Waves` in blue, color-coded by quality (green/yellow/red)
- Popup: spot name, water body, temperature, quality badge, visibility, algae warning, link to LAGeSo detail page
- Register `bathing-icon-good`, `bathing-icon-warning`, `bathing-icon-poor` icons in `map-icons.ts`

### 8. Layer toggle — new "Water" parent layer

Restructure: rename `'water-levels'` DataLayer to `'water'` and introduce sub-layers (same pattern as `emergencies` → `pharmacies` | `aeds`):

- New type: `WaterSubLayer = 'levels' | 'bathing'`
- New state: `waterSubLayers: Set<WaterSubLayer>` (default: both on)
- New action: `toggleWaterSubLayer(sub: WaterSubLayer)`
- `DataLayerToggles.tsx`: render "Water" group with sub-items "Water Levels" and "Bathing Water"
- CityMap.tsx: gate both water-levels data and bathing data behind `waterActive && waterSubLayers.has(...)`
- Update all references from `'water-levels'` to `'water'` in DataLayer type, activeLayers, and CityMap.tsx visibility gates

### 9. Off-season indicator

- Add `inSeason: boolean` to the `BathingSpot` type — derived server-side from current date (true if May 15 – Sep 15)
- When `inSeason` is false, the map popup shows an "Off-season" badge and the measurement date
- The frontend hook and layer always show data regardless of season

### 10. i18n

- Add translation keys for all 4 languages (EN/DE/TR/AR):
  - `layers.bathing` — layer name
  - `bathing.good`, `bathing.warning`, `bathing.poor` — quality labels
  - `bathing.temperature`, `bathing.visibility`, `bathing.algae`, `bathing.waterBody`

### 11. Tests

- `ingest-bathing.test.ts` — unit tests (mock fetch, verify CSV parsing, quality mapping, edge cases)
- `bathing.test.ts` — route integration tests (empty cache, populated cache, unknown city)

## Files to create/modify

| File | Action |
|---|---|
| `shared/types.ts` | Add `BathingSpot` interface |
| `packages/server/src/cron/ingest-bathing.ts` | **Create** — CSV fetch + parse |
| `packages/server/src/cron/ingest-bathing.test.ts` | **Create** — unit tests |
| `packages/server/src/routes/bathing.ts` | **Create** — GET endpoint |
| `packages/server/src/routes/bathing.test.ts` | **Create** — route tests |
| `packages/server/src/app.ts` | Register cron + route |
| `packages/web/src/lib/api.ts` | Add `getBathing` + re-export type |
| `packages/web/src/hooks/useBathing.ts` | **Create** — React Query hook |
| `packages/web/src/hooks/useCommandCenter.ts` | Rename `water-levels` → `water`, add WaterSubLayer type + state |
| `packages/web/src/lib/map-icons.ts` | Register bathing spot icons |
| `packages/web/src/components/map/CityMap.tsx` | Add map layer + popup |
| `packages/web/src/components/sidebar/DataLayerToggles.tsx` | Add toggle |
| `packages/web/src/i18n/{en,de,tr,ar}.json` | Add translation keys |
