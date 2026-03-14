# Batch Implementation Follow-Up — Stunning Dashboard (Plans 01–08)

## Controversial Decisions

- **Plan 03**: Used `position: fixed` for TopBar instead of `sticky` (per code review). This means TopBar overlaps content when visible — acceptable since it only appears after scrolling past the hero map.
- **Plan 04**: Used Tailwind arbitrary value syntax `bg-[var(--surface-1)]` for CSS variable integration. This works in Tailwind v4 but generates longer class names. Alternative was defining custom theme colors in Tailwind config.
- **Plan 08**: `useTheme.toggle()` now accepts an optional `MouseEvent` parameter for the View Transitions circle-wipe origin. The keyboard shortcut (`D` key) calls `toggle()` without an event, which defaults the circle origin to 50%/50% (center of screen). This is intentional — only clicks get a position-based wipe.
- **Plan 08**: Skipped high-DPI icon refactor (Plan 08, Part C3). MapLibre already uses `window.devicePixelRatio` by default and CARTO vector tiles scale naturally. The canvas icons may look slightly soft on 3x displays, but the risk of breaking icon rendering across all layers outweighs the visual improvement. Recommend testing on a Retina device before applying.

## Skipped Items

- **Plan 04**: Content pages (ImprintPage, PrivacyPage, SourcesPage, NoTrackingPage) still use `dark:bg-gray-900` / `dark:bg-gray-950`. These are secondary pages; migrating them is straightforward but deferred to avoid scope creep. The CSS variables still work (just not used in those files yet).
- **Plan 04**: CouncilMeetingsStrip has `dark:bg-gray-900/95` for a sticky header — not migrated since it's a data strip with specific opacity needs.
- **Plan 07**: First-visit keyboard shortcut toast (localStorage flag `hasSeenKeyboardHints`) was not implemented. The `?` key hint overlay works, but there's no proactive notification to new users. This could be added as a follow-up.
- **Plan 08**: Vite plugin for modulepreload injection was skipped — the style JSON preload handles the critical path.

## Suggested Follow-Up Work

- Migrate remaining content pages (Imprint, Privacy, Sources, NoTracking) to CSS surface variables for full consistency.
- Add first-visit toast for keyboard shortcuts (Plan 07 A4).
- Test high-DPI icon rendering on Retina devices and apply `devicePixelRatio` fix if needed.
- Create Hamburg skyline SVG variant for SkylineSeparator (Plan 03 B4).
