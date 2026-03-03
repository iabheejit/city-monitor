# Plan 02 — Global Focus Visible Styles

## Problem

Almost no interactive element in the app has a visible focus indicator. Keyboard users cannot tell which element is currently focused. This affects every button, link, and form control.

**WCAG violation:** 2.4.7 Focus Visible (AA)

## Scope

Affects all interactive elements across the entire app. Key files:
- `TopBar.tsx` — language buttons, theme toggle, hamburger
- `DataLayerToggles.tsx` — layer buttons, sub-layer buttons
- `EventsStrip.tsx` / `NewsStrip.tsx` — tab pills
- `BudgetStrip.tsx` — mode selector, district selects
- `NinaBanner.tsx` — expand/dismiss buttons
- `Tile.tsx` — expandable headers (after Plan 01 fix)
- `MobileLayerDrawer.tsx` — tab handle

## Approach

Add a global `focus-visible` style in the Tailwind CSS layer so every `<button>`, `<a>`, `<select>`, and `[role="button"]` gets a focus ring without modifying individual components.

### Option A — Global CSS rule (Recommended)
Add to the app's global CSS (e.g., `index.css` or Tailwind base layer):
```css
@layer base {
  button:focus-visible,
  a:focus-visible,
  select:focus-visible,
  [role="button"]:focus-visible {
    outline: 2px solid var(--accent, #3b82f6);
    outline-offset: 2px;
  }
}
```
This is a single change that covers the entire app. Uses city accent color when available, falls back to blue.

### Option B — Per-component Tailwind classes
Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]` to each interactive element individually. More precise control but ~30+ files to touch.

**Decision:** Focus rings use the city accent color via `var(--accent)`, falling back to blue.

## Changes

### 1. `packages/web/src/index.css` (or equivalent global CSS file)
- Add the `@layer base` focus-visible rule from Option A

### 2. Verify no component has `outline-none` or `outline: none` that would override
- `BudgetStrip.tsx:170` has `outline-none` on the `<select>` — remove it

## Testing
- Tab through entire UI — every interactive element should show a visible focus ring
- Focus ring should not appear on mouse click (`:focus-visible` handles this)
- Test in both light and dark themes
