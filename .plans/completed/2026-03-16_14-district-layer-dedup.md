# Plan 14: Extract duplicated district layer logic into shared helper

**Type:** refactor
**Complexity:** simple
**Files affected:** 2

## Problem

`CityMap.tsx` contains two near-identical blocks of code that add the `districts` GeoJSON source and three layers (`district-fill`, `district-line`, `district-label`) to the map:

1. **Style.load handler** (lines ~374-403): Restores district layers after a theme swap when political mode is active.
2. **politicalActive effect** (lines ~700-741): Adds district layers when the user activates a political sub-layer.

Both blocks duplicate the same source/layer setup that already exists in `addDistrictLayer()` in `political.ts`, but with two differences:
- The inline blocks use a flat `fill-opacity: 0.35` instead of the hover-aware expression in `addDistrictLayer`.
- The inline blocks call `ensureDistrictLabelsBelow()` after adding layers, while `addDistrictLayer` uses the `beforeId` parameter at add-time.

The flat `fill-opacity` is intentional for political mode (party colors replace the hover fill), so the new helper must support this. The label-ordering approaches are functionally equivalent.

## Approach

Add a new exported function `addDistrictSource` to `political.ts` that encapsulates the shared logic: add the GeoJSON source and the three layers. Both CityMap.tsx call sites will use it instead of inline layer creation.

### New function signature

```ts
export function addDistrictSource(
  map: maplibregl.Map,
  geojson: GeoJSON.FeatureCollection,
  nameField: string,
  isDark: boolean,
): void
```

This function will:
1. Add the `districts` source with `generateId: true`.
2. Add `district-fill` with flat `fill-opacity: 0.35` (appropriate for political mode -- the only caller context).
3. Add `district-line` with dashed styling.
4. Add `district-label` with the given `nameField`.
5. Call `ensureDistrictLabelsBelow(map)`.

It does **not** fetch GeoJSON or remove existing layers -- callers handle those concerns differently (the style.load handler checks `map.getSource('districts')` to bail early; the effect explicitly removes old layers before calling).

### Why not reuse `addDistrictLayer`

`addDistrictLayer` fetches its own GeoJSON, removes existing layers, and uses hover-aware fill-opacity. It serves the non-political district overlay. Merging the two would require adding flags/options that complicate a function that's already clean. A separate `addDistrictSource` for the political-mode path is simpler and more explicit.

### Changes

**`packages/web/src/components/map/layers/political.ts`**
- Add `addDistrictSource(map, geojson, nameField, isDark)` after the existing `addDistrictLayer` function.

**`packages/web/src/components/map/CityMap.tsx`**
- **Style.load handler (~line 380-397):** Replace the inline `addSource` + 3x `addLayer` + `ensureDistrictLabelsBelow` with:
  ```ts
  addDistrictSource(map, geojson, isDark, resolved.nameField);
  ```
- **politicalActive effect (~line 704-740):** Replace the same block with:
  ```ts
  addDistrictSource(map, geojson, resolved.nameField, isDark);
  ```
- Add `addDistrictSource` to the import from `./layers/political.js`.

### What stays at the call sites

- Style.load handler: the `fetch`, the `if (map.getSource('districts')) return` guard, the `activeNameFieldRef` assignment, the `applyPoliticalStyling` call, and the `.catch` fallback to `addDistrictLayer`.
- politicalActive effect: the `fetch` with `AbortController`, the layer/source removal block, the `politicalGeoFeaturesRef` assignment, `applyPoliticalStyling`, and `updatePoliticalMarkers`.

## Testing

- Run `npx turbo run typecheck` to verify no type errors.
- Manual verification: toggle political layers on/off, switch themes while political is active -- district boundaries should render identically to current behavior.
