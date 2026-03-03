# AED Locations Layer + Emergencies Group

## Goal

Add AED (defibrillator) locations to the map and restructure the "Pharmacies" sidebar toggle into an "Emergencies" group with "Pharmacies" and "AEDs" as sub-items (similar to how "Political" has sub-items for Bezirke/Bundestag/Landesparlament).

## Data Source

**OpenStreetMap via Overpass API** (from `.context/new-data-sources.md` §5):
- Query: `[out:json];area["name"="Berlin"]["admin_level"="4"]->.s;node["emergency"="defibrillator"](area.s);out body;`
- ~127 AEDs in Berlin, free, no auth, no rate limits (reasonable use)
- Fields: lat/lon, indoor/outdoor, location description, operator, opening hours

## Architecture

Follows the existing **cache-only ingestion pattern** (same as pharmacies, traffic, construction — no Postgres persistence).

### Server

1. **Shared type** (`shared/types.ts`): Add `AedLocation` interface
2. **Cron job** (`packages/server/src/cron/ingest-aeds.ts`): Fetch Overpass API once daily, parse OSM nodes → `AedLocation[]`, store in cache key `{cityId}:aed:locations` with 24h TTL
3. **Route** (`packages/server/src/routes/aeds.ts`): `GET /api/:city/aeds` — cache read-through
4. **App wiring** (`packages/server/src/app.ts`): Register cron (daily, `runOnStart: true`) + route with `cacheFor(3600)`

### Frontend

5. **API client** (`packages/web/src/lib/api.ts`): Add `AedLocation` type + `getAeds()` method
6. **React Query hook** (`packages/web/src/hooks/useAeds.ts`): 24h refetch, 12h stale
7. **Zustand store** (`packages/web/src/hooks/useCommandCenter.ts`):
   - Replace `'pharmacies'` DataLayer with `'emergencies'`
   - Add `EmergencySubLayer = 'pharmacies' | 'aeds'` type
   - Add `emergencySubLayers: Set<EmergencySubLayer>` state (default: both on)
   - Add `toggleEmergencySubLayer()` action
8. **Map icons** (`packages/web/src/lib/map-icons.ts`): Register `aed-icon` using Lucide `HeartPulse` icon in red
9. **CityMap.tsx**: Add `aedToGeoJSON()`, `updateAedMarkers()`, reactive `useEffect`, simplifyMap guard for `aed-` prefix
10. **DataLayerToggles.tsx**: Replace standalone `pharmacies` toggle with `emergencies` group. When expanded, show sub-toggles for Pharmacies and AEDs (like political sub-items but with checkboxes instead of radio)
11. **i18n** (4 files): Add keys for `emergencies`, `emergencies.pharmacies`, `emergencies.aeds`

### AedLocation Interface

```typescript
export interface AedLocation {
  id: string;          // "aed-{osmNodeId}"
  lat: number;
  lon: number;
  indoor: boolean;
  description?: string; // defibrillator:location tag
  operator?: string;
  openingHours?: string;
  access?: string;     // "yes" | "public" | "private" | "permissive"
}
```

### Overpass Response Shape

```json
{
  "elements": [
    {
      "type": "node",
      "id": 12345678,
      "lat": 52.52,
      "lon": 13.405,
      "tags": {
        "emergency": "defibrillator",
        "indoor": "yes",
        "defibrillator:location": "In the lobby",
        "operator": "Berlin DRK",
        "opening_hours": "Mo-Fr 08:00-18:00",
        "access": "yes"
      }
    }
  ]
}
```

### UI Behavior

The "Emergencies" toggle works like a group:
- Clicking "Emergencies" toggles the entire group on/off (like any other DataLayer)
- When active, sub-toggles appear below for "Pharmacies" and "AEDs" (both default on)
- Sub-toggles are independent checkboxes (not radio buttons like political)
- In single-view mode, selecting "Emergencies" shows both sub-layers; sub-toggles let you hide one

## File Changes Summary

| File | Change |
|------|--------|
| `shared/types.ts` | Add `AedLocation` interface |
| `packages/server/src/cron/ingest-aeds.ts` | **New**: Overpass API ingestion |
| `packages/server/src/routes/aeds.ts` | **New**: `GET /api/:city/aeds` route |
| `packages/server/src/app.ts` | Wire cron + route |
| `packages/web/src/lib/api.ts` | Add `AedLocation` type + `getAeds()` |
| `packages/web/src/hooks/useAeds.ts` | **New**: React Query hook |
| `packages/web/src/hooks/useCommandCenter.ts` | `pharmacies` → `emergencies`, add sub-layers |
| `packages/web/src/lib/map-icons.ts` | Register `aed-icon` |
| `packages/web/src/components/map/CityMap.tsx` | AED markers + visibility gate via sub-layers |
| `packages/web/src/components/sidebar/DataLayerToggles.tsx` | Emergencies group with sub-toggles |
| `packages/web/src/i18n/en.json` | Add emergencies + sub-layer labels |
| `packages/web/src/i18n/de.json` | Same |
| `packages/web/src/i18n/tr.json` | Same |
| `packages/web/src/i18n/ar.json` | Same |

## Confirmed Decisions

- **Cron interval**: Once daily (at midnight). AED data from OSM changes rarely.
- **Group toggle**: Simple on/off. Clicking "Emergencies" toggles the group. Sub-toggles control which sub-layers show. All sub-layers default to on.
- **Popup detail**: Full details — indoor/outdoor badge, location description, operator, opening hours, access type, plus directions link.
- **Multi-city**: Hamburg shows Emergencies group with Pharmacies only (no AED sub-toggle). Berlin shows both. The Overpass query uses city name/bounding box, so only cities that have the query configured will show AEDs.

## Testing

- **Server**: Unit test for `ingest-aeds.ts` (mock Overpass response), route test for `aeds.ts`
- **Frontend**: No hardcoded-content tests; test toggle logic in `useCommandCenter` (emergencies group + sub-layer toggling)
