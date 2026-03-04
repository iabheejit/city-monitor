# Noise layer: add Live Data sub-item

## Goal

Add "Live data" as an independent toggle alongside the WMS map sub-layers. Change WMS maps from always-one-selected radio to optional radio (can deselect). On activating "Noise" category, default to Live data ON + "All sources" (total) WMS map selected.

## Current behavior

- `NoiseLayer = 'total' | 'road' | 'rail' | 'air'` — radio-style, always one selected
- `noiseActive` gates both WMS overlay and sensor markers together
- No way to show only sensors or only WMS

## Changes

### 1. Store (`useCommandCenter.ts`)

- Add `noiseLiveData: boolean` state (default `true`)
- Change `noiseLayer` type to `NoiseLayer | null` (null = no WMS map)
- Default: `noiseLayer: 'total'`, `noiseLiveData: true`
- Add `toggleNoiseLiveData()` action
- Change `setNoiseLayer(layer)` to toggle off if same layer clicked: `noiseLayer === layer ? null : layer`

### 2. UI (`DataLayerToggles.tsx`)

- Add `Radio` (or `Activity`) icon import for live data sub-item
- Render "Live data" sub-item first (checkbox-style, using `noiseLiveData`)
  - cities: `['berlin']` (Berlin-only, since backend returns empty for Hamburg)
- Render WMS map sub-items after (radio-style with deselect)
- WMS items: click sets `noiseLayer` to key (or null if already active)

### 3. Map (`CityMap.tsx`)

- Read `noiseLiveData` from store
- Gate `noiseSensorItems` on `noiseActive && noiseLiveData` instead of just `noiseActive`
- Gate `setNoiseOverlay` on `noiseActive && noiseLayer !== null`
- Pass `effectiveNoiseLayer` only when `noiseLayer` is not null

### 4. i18n (all 4 languages)

Add `sidebar.noise.live` key:
- EN: "Live Sensors"
- DE: "Live-Sensoren"
- TR: "Canlı Sensörler"
- AR: "أجهزة استشعار مباشرة"

## Files to modify

1. `packages/web/src/hooks/useCommandCenter.ts` — store types + state
2. `packages/web/src/components/sidebar/DataLayerToggles.tsx` — UI
3. `packages/web/src/components/map/CityMap.tsx` — map gating logic
4. `packages/web/src/i18n/{en,de,tr,ar}.json` — translation keys
