# Single / Multi View Toggle

## Goal
Add a sidebar toggle for "one view" vs. "multiple views". Single view is the default — selecting a data layer deactivates all others.

## Changes

### `packages/web/src/hooks/useCommandCenter.ts`
- Added `singleView: boolean` (default `true`) to Zustand store
- Added `toggleSingleView()` action that flips the boolean and clamps active layers to 1 when switching Multi→Single
- Modified `toggleLayer()` — in single-view mode, replaces the active set with the clicked layer (or empties it if toggling off the only active layer)

### `packages/web/src/components/sidebar/DataLayerToggles.tsx`
- Added "Single / Multi" toggle button at top of layer list with `aria-pressed` for accessibility
- Bold text indicates which mode is active

### i18n (en.json, de.json, tr.json, ar.json)
- Added `sidebar.viewMode.single` and `sidebar.viewMode.multi` keys

## Status
Completed 2026-03-03.
