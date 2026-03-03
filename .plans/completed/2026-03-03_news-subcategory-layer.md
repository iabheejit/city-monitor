# News Sub-Category Layer + Police Merge

## Goal

Merge the "News" and "Safety" (police) layers into a single "News" parent layer with multi-select sub-categories. Users can toggle any combination of news categories and police reports.

## Changes

### 1. State — `useCommandCenter.ts`

- Remove `'safety'` from `DataLayer` union (police becomes a News sub-layer)
- Add `NewsSubLayer` type: `'local' | 'politics' | 'transit' | 'culture' | 'crime' | 'economy' | 'sports' | 'police'`
- Add `newsSubLayers: Set<NewsSubLayer>` to state (default: all enabled)
- Add `toggleNewsSubLayer()` — same at-least-one pattern as traffic/emergency/water
- Remove `'safety'` from `LAYER_META` in DataLayerToggles

### 2. Sidebar — `DataLayerToggles.tsx`

- Move `'news'` to second position in `LAYER_META` (after `'warnings'`)
- Remove the `'safety'` entry entirely
- Add `NEWS_SUB_META` array with 8 entries (7 news categories + police), each with an icon and color
- Wire up `newsSubLayers` + `toggleNewsSubLayer` from the store
- Add `else if (layer === 'news' && active)` block rendering sub-layer items

### 3. Map — `CityMap.tsx`

- Read `newsSubLayers` from the store
- Filter `newsItems` by selected sub-layers: `newsDigest.items.filter(i => newsSubLayers.has(i.category))`
- Gate `safetyItems` on `activeLayers.has('news') && newsSubLayers.has('police')` instead of `activeLayers.has('safety')`

### 4. Dashboard tile — `CommandLayout.tsx`

- No changes — the NewsStrip tile stays independent (it has its own internal tab filter)
- SafetyStrip tile stays as-is too — it's a separate dashboard section

### 5. i18n (4 files)

- Remove `"safety"` from `sidebar.layers`
- Add `sidebar.news` section with sub-layer labels:
  - `local`, `politics`, `transit`, `culture`, `crime`, `economy`, `sports` — reuse existing `category.*` translations
  - `police` — EN: "Police", DE: "Polizei", TR: "Polis", AR: "الشرطة"

### 6. Icons

- News categories: use `Newspaper` icon (same icon, category color from `NEWS_CATEGORY_COLORS`)
- Police: use `ShieldAlert` icon with the existing safety orange color (`#f97316`)

## Not changing

- Server-side ingestion (news + safety are separate cron jobs, separate DB tables)
- API endpoints (still separate `/news/digest` and `/safety`)
- NewsStrip internal tab filter (independent of layer sub-categories)
- SafetyStrip dashboard tile (stays as its own tile)
- Bootstrap hook pre-seeding
