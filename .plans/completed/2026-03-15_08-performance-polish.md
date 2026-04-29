# Plan 08: Performance Polish — Preload, Theme Toggle, High-DPI

## Goal
1. Preload critical map tiles for instant map rendering
2. Optimistic/instant theme toggle with a visual wipe effect
3. Ensure high-DPI map rendering on Retina displays

## Current State

### Map Tile Loading
- **index.html:** Has `<link rel="preconnect" href="https://basemaps.cartocdn.com" crossorigin />`
- No tile preloading — map loads tiles on demand after MapLibre initializes
- CARTO style JSON fetched on mount, then individual vector tiles requested
- Initial view shows tile-by-tile loading (visible flash of empty/gray map)

### Theme Toggle
- **useTheme.ts:** Zustand store, toggles `.dark` class on `<html>`
- **globals.css:** Global 150ms transition on `background-color, color, border-color`
- Toggle is smooth but not instant — 150ms transition on every element
- No visual wipe/morph effect

### Map DPI
- **CityMap.tsx:** MapLibre initialized without explicit `pixelRatio` setting
- MapLibre defaults to `window.devicePixelRatio` — should already handle Retina
- No explicit check or override in the codebase
- CARTO tiles are vector-based, so they scale naturally to any DPI

## Implementation Plan

### Part A: Preload Critical Map Tiles

#### A1. Preload CARTO style JSON
- **File:** `packages/web/index.html`
- Add `<link rel="preload">` for both map style JSONs:
  ```html
  <link rel="preload" href="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json" as="fetch" crossorigin />
  ```
- Only preload the light style (most common initial load); dark style loads on demand
- Or: detect system preference via `<script>` in `<head>` and preload the matching style

#### A2. Preload MapLibre GL JS and CSS
- **File:** `packages/web/index.html`
- Since MapLibre is lazy-loaded (React.lazy in CommandLayout), the chunk doesn't load until the component mounts
- Add modulepreload for the MapLibre chunk:
  ```html
  <link rel="modulepreload" href="/assets/maplibre-HASH.js" />
  ```
- This is build-dependent — implement via Vite plugin that injects preload links for manual chunks

#### A3. Preload initial vector tiles (advanced)
- CARTO vector tiles for the initial viewport (Berlin, zoom 11) are predictable
- Could preload 4-6 tile URLs via `<link rel="preload" as="fetch">`
- However, tile URLs include zoom/x/y coordinates and are determined by the style spec
- More practical: use Service Worker to cache tiles after first load (for repeat visits)
- **Decision: Skip tile preloading, focus on style JSON preload + chunk preload**

### Part B: Optimistic Theme Toggle

#### B1. Instant class toggle (remove transition delay for toggle)
- Currently all elements have 150ms transition — this creates a cascade during toggle
- During theme toggle specifically, temporarily disable the global transition:
  ```js
  document.documentElement.style.setProperty('transition', 'none');
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  // Force reflow
  document.documentElement.offsetHeight;
  // Re-enable transitions
  requestAnimationFrame(() => {
    document.documentElement.style.removeProperty('transition');
  });
  ```
- This makes the toggle feel instant while keeping transitions for normal interactions

#### B2. Circular wipe animation (optional, View Transitions API)
- Use the View Transitions API (`document.startViewTransition()`) for a circle-expand effect:
  ```js
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      document.documentElement.classList.toggle('dark');
    });
  }
  ```
- CSS for circular wipe from the toggle button:
  ```css
  ::view-transition-new(root) {
    animation: 300ms ease-out circle-expand;
    clip-path: circle(0% at var(--toggle-x) var(--toggle-y));
  }
  @keyframes circle-expand {
    to { clip-path: circle(150% at var(--toggle-x) var(--toggle-y)); }
  }
  ```
- Set `--toggle-x` and `--toggle-y` CSS vars from the button's click position
- Graceful fallback: browsers without View Transitions API get instant toggle (B1)

#### B3. Update useTheme hook
- **File:** `packages/web/src/hooks/useTheme.ts`
- Add the instant-toggle logic to the `toggle()` function
- Store button position in a transient ref for the circle-wipe origin

### Part C: High-DPI Map Rendering

#### C1. Verify current DPI handling
- MapLibre GL JS already uses `window.devicePixelRatio` by default for canvas rendering
- Vector tiles (CARTO GL) render at native resolution — no raster scaling issues
- **This should already work correctly** — verify with a Retina device

#### C2. Explicit pixelRatio override (if needed)
- **File:** `packages/web/src/components/map/CityMap.tsx`
- If testing reveals issues, explicitly set:
  ```js
  new maplibregl.Map({
    pixelRatio: window.devicePixelRatio,
    // ... other options
  });
  ```

#### C3. Icon sharpness at high DPI
- **File:** `packages/web/src/lib/map-icons.ts`
- Canvas-rendered icons (36×36) may appear blurry on 2x/3x displays
- Fix: Render icons at `size * devicePixelRatio` then set the MapLibre image at `pixelRatio: devicePixelRatio`
- Update `createMapIcon()` and `createBadgeIcon()`:
  ```js
  const dpr = window.devicePixelRatio || 1;
  const canvas = new OffscreenCanvas(size * dpr, size * dpr);
  ctx.scale(dpr, dpr);
  // ... draw at logical size ...
  map.addImage(id, imageData, { pixelRatio: dpr });
  ```
- This ensures crisp icons on all displays

#### C4. Preconnect for tile CDN (already done)
- `index.html` already has `<link rel="preconnect" href="https://basemaps.cartocdn.com" crossorigin />`
- No changes needed

## Files to Modify
| File | Changes |
|------|---------|
| `packages/web/index.html` | Preload style JSON, modulepreload hints |
| `packages/web/src/hooks/useTheme.ts` | Instant toggle logic, View Transitions API |
| `packages/web/src/globals.css` | View Transition keyframes |
| `packages/web/src/components/map/CityMap.tsx` | Explicit pixelRatio (if needed) |
| `packages/web/src/lib/map-icons.ts` | High-DPI icon rendering |
| `packages/web/vite.config.ts` | Plugin for modulepreload injection (optional) |

## Decisions

- **Theme toggle effect:** Circular wipe via View Transitions API. Circle expands from the toggle button's position, revealing the new theme. Graceful fallback to instant toggle in browsers without View Transitions API support (Firefox, older Safari).
- **Map style preloading:** Detect system/localStorage preference in an inline `<head>` script, preload the matching CARTO style JSON. Covers the common case without wasting bandwidth.
- **High-DPI icons:** Verify during implementation on a Retina display. If icons look blurry, apply the `devicePixelRatio` fix to `createMapIcon()` and `createBadgeIcon()`. If they already look sharp (MapLibre may handle this), skip C3.

## Testing
- Performance: Measure Time to First Map Render before/after preload changes (Lighthouse)
- Visual: Theme toggle feels instant (no visible transition cascade)
- Visual: Circle wipe animation works in Chrome/Edge (View Transitions API)
- Visual: Graceful fallback in Firefox/Safari (instant toggle)
- Visual: Map icons are crisp on Retina displays (2x and 3x)
- Visual: Map icons are not oversized on 1x displays (proper scaling)
- Functional: Theme preference still persists in localStorage
- Functional: Map still loads correctly in both themes
