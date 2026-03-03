# Accessibility Polish

Fix remaining accessibility gaps: missing labels, semantic markup, color contrast, and chart alternatives.

## Context

Several a11y plans were already completed (see `.plans/completed/2026-03-03_a11y-*.md`). This plan covers gaps identified in the latest audit that weren't addressed.

## Changes

### 1. Missing aria-labels on interactive elements

- **Theme toggle button** (`HeaderControls.tsx:50-66`): Add `aria-label={t('theme.toggle')}` to the button wrapping the sun/moon SVG.
- **Tile expand/collapse button** (`Tile.tsx:41-65`): Add `aria-label` that includes the tile name and state (e.g., "Expand weather" / "Collapse weather"). Use `aria-expanded` attribute.
- **Language buttons** (`HeaderControls.tsx:68-85`): Ensure each language button has `aria-label` with the full language name (e.g., "Switch to German").

### 2. Chart accessibility

- **Budget pie chart** (`BudgetStrip.tsx:103`): Add a visually-hidden table summarizing the pie chart data for screen readers. Use `aria-hidden="true"` on the SVG and provide the table as an alternative.
- **Wastewater sparklines** (`WastewaterStrip.tsx:67`): Add `aria-label` with a text summary (e.g., "Influenza A: rising trend, 4.2 million gene copies per liter").
- **AQI gauge** (`AirQualityStrip.tsx`): Ensure the gauge SVG has a descriptive `aria-label` with the numeric AQI value and category.

### 3. Semantic markup

- **Footer links** (`Footer.tsx:29`): Wrap the footer link list in a `<nav aria-label="Footer">` element.
- **News category pills** (`NewsStrip.tsx:82`): Ensure the tab list has `role="tablist"` and each pill has `role="tab"` + `aria-selected`. (Check if this was already addressed in a previous a11y plan.)

### 4. Color contrast verification

- **AQI badge** (`AqiTooltip.tsx:23`): Verify that all level-color combinations (especially yellow/green backgrounds with dark text) meet WCAG AA 4.5:1 contrast ratio. Adjust text color per background if needed.
- **News category pills** (`NewsStrip.tsx:98`): Verify contrast of white text on `bg-gray-900` in light theme.

### 5. Favicon alt text — `NewsStrip.tsx:147`

Currently `alt=""` (decorative). This is correct if the source name is already displayed as text next to the icon. Verify this is the case; if the icon is the only indicator of the source, add `alt={item.sourceName}`.

## Testing

- Axe DevTools audit on dashboard page (0 critical/serious violations)
- Keyboard-only navigation test: can reach and activate all interactive elements
- Screen reader spot-check: tiles announce their content and state correctly

## Scope

- 8-10 files modified
- No new dependencies, no migration
