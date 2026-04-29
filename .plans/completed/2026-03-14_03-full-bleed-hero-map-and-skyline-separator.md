# Plan 03: Full-Bleed Hero Map & Animated Skyline Separator

## Goal
1. On initial load, the map fills 100vh as a dramatic hero section
2. A scroll indicator ("scroll to explore") invites the user downward
3. An SVG skyline silhouette of Berlin separates the map from the dashboard tiles
4. The skyline could have a subtle parallax or animation effect

## Current State
- **CommandLayout:** `packages/web/src/components/layout/CommandLayout.tsx`
  - Upper zone: `h-[50vh] lg:h-[calc(100vh-37px)]` — map is already nearly full-height on desktop
  - Lower zone: dashboard tiles, no separator
- **TopBar height:** ~37px (used in calc)
- **No scroll indicators or decorative elements**

## Implementation Plan

### Part A: Full-Bleed Hero Map

#### A1. Make map 100vh permanently
- **File:** `packages/web/src/components/layout/CommandLayout.tsx`
- Upper zone height = `100vh` always (no TopBar subtraction — map goes edge-to-edge)
- Map is always the hero — dashboard tiles are always below the fold

#### A2. Scroll indicator (mouse icon with animated scroll wheel)
- Add a floating element at the bottom of the hero map section:
  - Centered, absolute positioned, `bottom: 24px`
  - SVG mouse icon (~24×36px) with an animated dot inside representing the scroll wheel
  - Dot animates: small circle moves from top to bottom of the mouse body in a loop (CSS `@keyframes scroll-dot`)
  - Fades out as user scrolls (opacity tied to scroll position via IntersectionObserver or scroll listener)
- On click: smooth scroll to dashboard section

#### A3. TopBar hidden initially, appears on scroll
- **File:** `packages/web/src/components/layout/TopBar.tsx`
- TopBar starts with `transform: translateY(-100%); opacity: 0`
- Use IntersectionObserver on the dashboard section (lower zone)
- When dashboard enters viewport (user has scrolled past hero map), TopBar slides in: `transform: translateY(0); opacity: 1`
- Transition: 300ms ease-out
- TopBar becomes sticky once visible: `position: sticky; top: 0; z-index: 50`
- On scroll back to top (dashboard leaves viewport), TopBar slides back out

#### A4. Responsive behavior
- Mobile: Map stays 100vh hero, scroll indicator still present, TopBar hidden until scroll
- Desktop: Same 100vh hero, sidebar overlays with semi-transparent background
- Sidebar styling update: `bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm`

### Part B: Berlin Skyline SVG Separator

#### B1. Create skyline SVG
- Hand-draw or source an SVG silhouette of Berlin's skyline including:
  - Fernsehturm (TV Tower) — most iconic
  - Brandenburger Tor (Brandenburg Gate)
  - Berliner Dom (Cathedral)
  - Generic building outlines for fill
- SVG should be a single path, horizontally tileable, ~200px tall
- Two variants: one for light mode (dark silhouette), one for dark mode (light silhouette), or use `currentColor`

#### B2. Place as separator between map and tiles
- **File:** `packages/web/src/components/layout/CommandLayout.tsx`
- Insert between upper and lower zones
- Full-width, `overflow: hidden`
- Use negative margin to overlap slightly with the map bottom (-20px to -40px)
- Background color matches the dashboard section (`bg-gray-50 dark:bg-gray-950`)
- SVG fills as foreground in the accent or gray color

#### B3. Optional animation
- Option: Subtle horizontal scroll animation (CSS `@keyframes slide`) for a "city moving" effect
- Option: Parallax — skyline moves at different speed than scroll (via `transform: translateY()` on scroll)
- Keep it subtle — decorative, not distracting

#### B4. Hamburg variant
- If Hamburg becomes active, create a Hamburg skyline (Elbphilharmonie, Michel, Speicherstadt)
- Select based on `city.id` in the component
- For now, only Berlin SVG needed

## Files to Create
| File | Purpose |
|------|---------|
| `packages/web/src/components/layout/SkylineSeparator.tsx` | Skyline SVG component with city variant |
| `packages/web/src/assets/skyline-berlin.svg` | Berlin skyline SVG (or inline in component) |

## Files to Modify
| File | Changes |
|------|---------|
| `packages/web/src/components/layout/CommandLayout.tsx` | 100vh hero, scroll indicator, skyline separator |
| `packages/web/src/components/layout/TopBar.tsx` | Semi-transparent overlay styling |
| `packages/web/src/components/sidebar/Sidebar.tsx` | Semi-transparent overlay styling |
| `packages/web/src/globals.css` | Bounce keyframes, parallax utilities |
| `packages/web/src/i18n/en.json` (+ de, tr, ar) | "Scroll to explore" translation key |

## Decisions

- **Scroll indicator:** Mouse icon with animated scroll-wheel dot (common landing page pattern)
- **Separator:** Berlin skyline SVG — hand-drawn geometric silhouette (TV Tower, Brandenburg Gate, Cathedral). Will need Hamburg variant later.
- **TopBar behavior:** Hidden initially, appears on scroll. Slides in when user scrolls past the hero map section. Uses IntersectionObserver on the dashboard section.
- **Hero persistence:** Always 100vh — map is permanently the hero. Dashboard tiles are always below the fold.

## Testing
- Visual: Map fills viewport on load, scroll indicator visible and animated
- Visual: Skyline SVG renders correctly in light and dark mode
- Visual: TopBar readable over map with semi-transparent background
- Responsive: Works on mobile (100vh map, scroll indicator, skyline)
- Functional: Scroll indicator click smooth-scrolls to dashboard
- Functional: Sidebar still usable with semi-transparent background
- Performance: No scroll jank from parallax effects
