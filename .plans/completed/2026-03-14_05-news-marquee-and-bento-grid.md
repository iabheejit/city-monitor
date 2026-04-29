# Plan 05: News Marquee & Bento Grid Layout

## Goal
1. Add a scrolling news ticker/marquee below the TopBar showing latest headlines
2. Redesign the dashboard grid into a magazine-style bento layout where key tiles are visually larger and more prominent

## Current State

### Dashboard Grid
- **File:** `packages/web/src/components/layout/DashboardGrid.tsx`
- Simple CSS grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4`
- Tiles have `span` prop: `1 | 2 | 'full'`
- Current layout is uniform — all tiles have equal visual weight regardless of importance
- 19 tiles total, ordered by editorial priority

### News Data
- **Hook:** News data available via React Query hooks
- **NewsStrip:** Shows 15 items with category tabs, scrollable list
- **BriefingStrip:** AI-generated summary, plain text

### Current Tile Spans
- span-2: Briefing, News, Budget, Council Meetings, Events
- span-1: Weather, AQI, Pollen, Wastewater, Transit, Appointments, Feuerwehr, Bathing, Labor Market, Population, Support, Crisis, Water Levels, Political

## Implementation Plan

### Part A: News Marquee

#### A1. Create NewsMarquee component
- **New file:** `packages/web/src/components/layout/NewsMarquee.tsx`
- Horizontal scrolling strip below TopBar (above map)
- Shows latest 5-10 news headlines in a continuous loop
- CSS animation: `@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`
- Duplicate content for seamless loop (render headlines twice, animate first set off-screen)
- Height: ~32px, font-size: text-sm
- Background: `var(--surface-1)` with subtle top/bottom border
- Text: headline with source prefix, separated by bullet (•) or pipe (|)

#### A2. Interaction
- **Pause on hover** — CSS `animation-play-state: paused` on `:hover`
- **Click headline** — opens article URL in new tab
- **Hover headline** — underline + accent color
- Speed: ~60px/second (adjustable via CSS custom property `--marquee-speed`)

#### A3. Placement
- **File:** `packages/web/src/components/layout/Shell.tsx` or `CommandLayout.tsx`
- Insert between TopBar and map section
- Sticky with TopBar (both stay at top on scroll)
- Hide on mobile if too crowded (optional: show as single rotating headline on mobile)

#### A4. Data source
- Reuse existing news React Query hook
- Take first N items sorted by recency
- Show headline + source name
- Graceful fallback: hide marquee if no news data yet (don't show empty bar)

### Part B: Bento Grid Layout (Primary Feature)

#### B1. Design the bento layout
Replace uniform grid with a magazine-style layout. The key insight: **important tiles get more visual real estate**.

**Proposed desktop (xl) layout — 4 columns:**
```
┌─────────────────────┬──────────┬──────────┐
│                     │ Weather  │ AQI      │
│  Briefing (2×2)     │ (1×1)    │ (1×1)    │
│                     ├──────────┴──────────┤
│                     │  Transit (2×1)      │
├──────────┬──────────┼──────────┬──────────┤
│ Pollen   │ Waste-   │ Feuerwehr│ Bathing  │
│ (1×1)    │ water    │ (1×1)    │ (1×1)    │
│          │ (1×1)    │          │          │
├──────────┴──────────┼──────────┴──────────┤
│  News (2×1)         │  Events (2×1)       │
├──────────┬──────────┼──────────┬──────────┤
│ Appoint. │ Labor    │ Populat. │ Support  │
│ (1×1)    │ (1×1)    │ (1×1)    │ (1×1)    │
├──────────┴──────────┼──────────┴──────────┤
│ Budget (2×1)        │ Council (2×1)       │
├──────────┬──────────┼──────────┬──────────┤
│ Crisis   │ Water Lv │ Politic. │          │
│ (1×1)    │ (1×1)    │ (1×1)    │          │
└──────────┴──────────┴──────────┴──────────┘
```

#### B2. Add row-span support to Tile component
- **File:** `packages/web/src/components/layout/Tile.tsx`
- Add `rowSpan` prop: `1 | 2` (default 1)
- CSS: `row-span-1` / `row-span-2`
- Requires switching DashboardGrid to explicit `grid-template-rows` or using `grid-auto-rows: minmax(min-content, auto)` with row-span

#### B3. Update DashboardGrid for bento
- **File:** `packages/web/src/components/layout/DashboardGrid.tsx`
- Keep the same responsive breakpoints but add:
  - `grid-auto-rows: minmax(0, auto)` for flexible row heights
  - Named grid areas (optional, more complex) OR rely on span + auto-placement
- The Briefing tile gets `span-2` (cols) + `rowSpan-2` (rows) = 2×2 hero block

#### B4. Hero tile visual treatment
- The Briefing tile (2×2) gets special styling:
  - Larger title font
  - Subtle background gradient or accent border on top
  - Optional: city-themed background image or pattern (very subtle, decorative)
- Weather could also get enhanced treatment with a larger temperature display

#### B5. Responsive bento
- **Mobile (< 640px):** Single column, no bento — all tiles stack vertically (current behavior)
- **Tablet (640-1279px):** 2-column bento — Briefing spans 2 cols, others 1 col, no row-span
- **Desktop (1280px+):** Full 4-column bento with row-spans

#### B6. Tile ordering
- Briefing remains first (hero position)
- Group tiles by theme:
  - Row 1-2: Briefing (hero) + Weather + AQI + Transit
  - Row 3: Environment (Pollen, Wastewater, Feuerwehr, Bathing)
  - Row 4: Information (News, Events)
  - Row 5: Services (Appointments, Labor, Population, Support)
  - Row 6: Governance (Budget, Council)
  - Row 7: Safety (Crisis, Water Levels, Political)

## Files to Create
| File | Purpose |
|------|---------|
| `packages/web/src/components/layout/NewsMarquee.tsx` | Scrolling news ticker |

## Files to Modify
| File | Changes |
|------|---------|
| `packages/web/src/components/layout/DashboardGrid.tsx` | Bento grid CSS, auto-rows |
| `packages/web/src/components/layout/Tile.tsx` | Add rowSpan prop, hero variant styling |
| `packages/web/src/components/layout/CommandLayout.tsx` | Insert NewsMarquee, update tile spans/order |
| `packages/web/src/components/layout/Shell.tsx` | NewsMarquee placement (if at shell level) |
| `packages/web/src/globals.css` | Marquee keyframes, bento utilities |
| `packages/web/src/i18n/en.json` (+ de, tr, ar) | Marquee-related strings if any |

## Decisions

- **Hero tile:** Briefing (AI summary) — 2×2 in the bento grid. Most unique content, positioned as the "city pulse" centerpiece.
- **Marquee style:** Continuous smooth scroll at ~60px/s. Pause on hover. Headlines duplicate for seamless loop. CSS `animation: marquee` with `translateX`.
- **Tile ordering:** Yes, regroup by theme. Groups: Environment (weather, AQI, pollen, wastewater, bathing), Transport (transit, feuerwehr), Information (news, events), Services (appointments, labor, population), Governance (budget, council), Safety (crisis, water levels, political). No section headers — let visual grouping speak for itself.
- **Animation library:** framer-motion (shared with plans 02, 03, 07).

## Testing
- Visual: Bento layout renders correctly at all breakpoints (mobile, tablet, desktop)
- Visual: Marquee scrolls smoothly, pauses on hover, headlines are clickable
- Visual: Hero tile (2×2) looks proportional and premium
- Responsive: Mobile gracefully falls back to single-column stack
- Functional: All tiles still expand/collapse correctly in new layout
- Functional: Marquee loads data from existing news hook, hides when no data
- Performance: Marquee CSS animation doesn't cause repaints (transform-only)
- Accessibility: Marquee has `aria-live="off"` or `role="marquee"`, can be paused, respects reduced-motion
