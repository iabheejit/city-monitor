# Plan 19 — PoliticalStrip Keyboard Navigation & ARIA Roles

**Type:** bugfix (accessibility)
**Complexity:** simple
**Files affected:** 1 (`packages/web/src/components/strips/PoliticalStrip.tsx`)

## Problem

The three-way view selector tabs (State / Districts / Bundestag) in `PoliticalStrip` use plain `<button>` elements without any ARIA tab semantics or keyboard navigation. Every other tabbed strip in the codebase (`BudgetStrip`, `NewsStrip`, `CrisisStrip`, `EventsStrip`) follows the full ARIA tabs pattern with `useTabKeys`, `role="tablist"`, `role="tab"`, `aria-selected`, roving `tabIndex`, and `role="tabpanel"`.

## Solution

Apply the exact same pattern used in `BudgetStrip` (lines 205-243). The changes are mechanical:

### 1. Add import for `useTabKeys` and `useCallback`

Change `import { useState } from 'react'` to `import { useCallback, useState } from 'react'` and add `import { useTabKeys } from '../../hooks/useTabKeys.js'`.

### 2. Wire up `useTabKeys` hook

After the existing `useFreshness` call (around line 182), add:

```ts
const views = [ ... ]; // already exists at ~line 186
const viewIdx = views.findIndex((v) => v.key === view);
const selectViewByIdx = useCallback((i: number) => setView(views[i]!.key), [views]);
const { setTabRef, onKeyDown } = useTabKeys(views.length, viewIdx, selectViewByIdx);
```

Note: `views` is currently defined later in the component (~line 186). Move or keep in place as long as it precedes the `useTabKeys` call. Since hooks must be called unconditionally and `views` is a plain array (no hook ordering issue), the existing position works -- just add the new lines right after it.

### 3. Add ARIA attributes to the tab bar container

Change the outer `<div>` at line 198 from:
```tsx
<div className="flex gap-0.5 ...">
```
to:
```tsx
<div role="tablist" className="flex gap-0.5 ...">
```

### 4. Add ARIA attributes to each tab button

Change each `<button>` from:
```tsx
<button
  key={v.key}
  onClick={() => setView(v.key)}
  className={...}
>
```
to:
```tsx
<button
  key={v.key}
  ref={setTabRef(i)}
  id={`political-tab-${v.key}`}
  role="tab"
  aria-selected={view === v.key}
  aria-controls="political-panel"
  tabIndex={view === v.key ? 0 : -1}
  onClick={() => setView(v.key)}
  onKeyDown={onKeyDown}
  className={...}
>
```

The `.map()` callback needs the index parameter: `views.map((v, i) => ...)`.

### 5. Add `tabpanel` role to the content area

Wrap the content below the tab bar (the ternary block from line 214 onward) in:
```tsx
<div id="political-panel" role="tabpanel" aria-labelledby={`political-tab-${view}`}>
  {/* existing content ternary */}
</div>
```

## Alternatives considered

- **Custom hook vs inline** -- Using the existing `useTabKeys` hook is clearly correct; it already handles ArrowLeft/Right, Home, End, and focus management. No reason to inline the logic.
- **Tab panel ID scheme** -- Using `political-panel` (single panel, swapped content) matches `BudgetStrip`'s `budget-panel` pattern. An alternative would be separate panels per view, but that deviates from the established codebase convention.

## Verification

Run the existing test suite to ensure no regressions:
```bash
npx turbo run test --filter=@city-monitor/web
```

Manual check: focus on a tab, press ArrowRight/ArrowLeft to move between tabs, verify focus moves and view changes.
