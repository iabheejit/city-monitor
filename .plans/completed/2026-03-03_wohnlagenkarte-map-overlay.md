# Wohnlagenkarte (Residential Quality) Map Overlay

## Goal

Add a Berlin Wohnlagenkarte map overlay showing residential quality zones (einfach/mittel/gut) from the official Berlin Open Data WMS. This is Berlin-only — Hamburg does not have this dataset.

## Data Source

- **WMS endpoint:** `https://gdi.berlin.de/services/wms/wohnlagenadr2024`
- **Layer name:** `wohnlagenadr2024`
- **License:** dl-de-zero-2.0 (public domain)
- **Formats:** Supports EPSG:3857 + PNG with transparency
- Public service, no API key — no server proxy needed (unlike weather tiles)

## Approach

Follow the exact `setWeatherOverlay` pattern in CityMap.tsx. This is purely a frontend feature:

### 1. Zustand store — add `'rent-map'` layer type
- Add `'rent-map'` to the `DataLayer` union in `useCommandCenter.ts`

### 2. Map overlay function — `setRentMapOverlay(map, visible)`
- Add to CityMap.tsx, right after `setWeatherOverlay`
- Uses MapLibre's WMS tile URL with `{bbox-epsg-3857}` placeholder:
  ```
  https://gdi.berlin.de/services/wms/wohnlagenadr2024?service=WMS&version=1.1.1&request=GetMap&layers=wohnlagenadr2024&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}
  ```
- Raster source + raster layer with ~0.6 opacity
- On toggle off: remove layer + source (same as weather)

### 3. Wire up in CityMap.tsx
- Add `rentMapActive` derived from `activeLayers.has('rent-map')`
- Add ref + style-swap re-add (same pattern as weather)
- Add `useEffect` to toggle the overlay
- Add prefix check in `simplifyMap` to preserve `rent-map-*` layers
- Berlin-only guard: skip the overlay for non-Berlin cities

### 4. Sidebar toggle
- Add entry to `LAYER_META` in DataLayerToggles.tsx
- Icon: `Home` from lucide (residential theme)
- Color: `#10b981` (emerald green — distinct from existing colors)

### 5. i18n
- Add `sidebar.layers.rent-map` to all 4 locale files (en/de/tr/ar)
- EN: "Rent Map", DE: "Mietspiegelkarte", etc.

### No server changes needed
- Public WMS, no proxy
- No dashboard strip (this is a spatial classification, not time-series data)
- No bootstrap/caching needed

## Files to modify

| File | Change |
|---|---|
| `packages/web/src/hooks/useCommandCenter.ts` | Add `'rent-map'` to `DataLayer` union |
| `packages/web/src/components/map/CityMap.tsx` | Add `setRentMapOverlay`, wire up toggle + effects |
| `packages/web/src/components/sidebar/DataLayerToggles.tsx` | Add layer meta entry |
| `packages/web/src/i18n/en.json` | Add translation |
| `packages/web/src/i18n/de.json` | Add translation |
| `packages/web/src/i18n/tr.json` | Add translation |
| `packages/web/src/i18n/ar.json` | Add translation |

## Not in scope

- Rent price lookups per address (would need the WFS + address input UI — future feature)
- Hamburg equivalent (doesn't exist)
- Server-side data — purely client-side WMS tile consumption
