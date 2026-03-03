# Plan 04 — ARIA Tabs Pattern Completion

## Problem

Tab interfaces in NewsStrip and EventsStrip have partial ARIA (`role="tablist"`, `role="tab"`, `aria-selected`) but are missing `aria-controls`, panel IDs, and keyboard navigation (arrow keys).

**WCAG violation:** 4.1.2 Name/Role/Value (A)

## Scope

| Component | File | Tab lists |
|---|---|---|
| NewsStrip | `NewsStrip.tsx:73-93` | 1 category tab list |
| EventsStrip | `EventsStrip.tsx:172-193, 197-216` | 2 tab lists (source + category) |
| BudgetStrip | `BudgetStrip.tsx:210-224` | 1 mode selector (not using role="tab" currently) |

## Approach

### Decision: Full ARIA tabs pattern
- Add `id` to each tab button and its associated panel
- Add `aria-controls="panel-{id}"` on each tab
- Add `role="tabpanel"` and `aria-labelledby="tab-{id}"` on each panel
- Add arrow key navigation (Left/Right to move between tabs, Home/End for first/last)
- Roving tabindex on tab buttons

## Changes

### 1. Create a reusable `TabList` helper (optional)
If going with Option A, extract a small hook or component to avoid duplicating arrow-key logic:
```tsx
function useTabKeys(items: string[], activeIndex: number, onSelect: (i: number) => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') onSelect((activeIndex + 1) % items.length);
    if (e.key === 'ArrowLeft') onSelect((activeIndex - 1 + items.length) % items.length);
    if (e.key === 'Home') onSelect(0);
    if (e.key === 'End') onSelect(items.length - 1);
  };
}
```

### 2. `packages/web/src/components/strips/NewsStrip.tsx`
- Add unique `id` to each tab button: `id={`news-tab-${cat}`}`
- Add `aria-controls="news-panel"`
- Add `tabIndex={resolvedCategory === cat ? 0 : -1}` (roving tabindex)
- Add `onKeyDown` handler for arrow keys
- Add `id="news-panel"` and `role="tabpanel"` and `aria-labelledby` on the content container

### 3. `packages/web/src/components/strips/EventsStrip.tsx`
- Same pattern for both source and category tab lists
- Use distinct ID prefixes: `events-source-tab-{key}`, `events-cat-tab-{key}`

### 4. `packages/web/src/components/strips/BudgetStrip.tsx`
- The mode selector (city/districts) is semantically a tab interface
- Add `role="tablist"` to the container, `role="tab"` + `aria-selected` to buttons
- Add `aria-controls` linking to the panel content

## Testing
- Arrow keys should navigate between tabs without moving focus out of the tab list
- Tab key should skip from the active tab to the panel content
- Screen reader should announce "tab 1 of 5, selected" etc.
