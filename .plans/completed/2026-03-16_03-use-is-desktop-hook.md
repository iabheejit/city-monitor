# Plan: Reactive `useMediaQuery` / `useIsDesktop` Hook

**Type:** bugfix
**Complexity:** simple

## Problem

In `CommandLayout.tsx:60-61`, `isDesktop` is computed once during render:

```ts
const isDesktop = typeof window !== 'undefined'
  && window.matchMedia('(min-width: 640px)').matches;
```

This value never updates on window resize. If a user loads the page on mobile then rotates/resizes to desktop (or vice versa), tiles keep their initial collapsed/expanded state.

## Solution

Create a generic `useMediaQuery(query)` hook that returns a reactive boolean, plus a thin `useIsDesktop()` wrapper. Replace the static check in `CommandLayout`.

### New file: `packages/web/src/hooks/useMediaQuery.ts`

```ts
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  // useSyncExternalStore is the React 18+ idiomatic way to subscribe to
  // external browser APIs. It handles SSR (getServerSnapshot), avoids
  // tearing, and is simpler than useEffect + useState.
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    () => false, // server snapshot (SSR fallback)
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 640px)');
}
```

**Why `useSyncExternalStore`:** It is the React-recommended primitive for subscribing to external stores (like matchMedia). It avoids the stale-closure and tearing issues that `useEffect` + `useState` patterns can have during concurrent rendering. It also has a clean server snapshot fallback. Alternatives considered:
- `useEffect` + `useState`: Works but more boilerplate and susceptible to tearing in concurrent mode.
- Third-party library (e.g., `usehooks-ts`): Adds a dependency for a trivial hook.

### Modified file: `packages/web/src/components/layout/CommandLayout.tsx`

1. Add import: `import { useIsDesktop } from '../../hooks/useMediaQuery.js';`
2. Replace lines 60-61 with: `const isDesktop = useIsDesktop();`
3. Remove nothing else -- the `isDesktop` variable name and all downstream usage stays the same.

The `BathingTile` sub-component receives `isDesktop` as a prop, so it will also re-render correctly when the value changes.

### New file: `packages/web/src/hooks/useMediaQuery.test.ts`

Test cases:
1. Returns `false` by default in jsdom (matches the existing test-setup mock).
2. (Optional) With a custom matchMedia mock that tracks addEventListener calls, verify the hook subscribes and cleans up.

### No changes needed

- `test-setup.ts`: The existing matchMedia mock already provides `addEventListener`/`removeEventListener` stubs, which is sufficient for `useSyncExternalStore`.
- `Tile.tsx` line 44 (`prefers-reduced-motion`): This is a one-time animation check, not a reactive state concern. Out of scope.
- `useScrollParallax.ts` / `useTheme.ts`: Their matchMedia usages are inside effects or initializers where staleness is acceptable. Out of scope.

## File Summary

| File | Action |
|------|--------|
| `packages/web/src/hooks/useMediaQuery.ts` | **Create** |
| `packages/web/src/hooks/useMediaQuery.test.ts` | **Create** |
| `packages/web/src/components/layout/CommandLayout.tsx` | **Modify** (3 lines) |

## Testing

- Run `npx turbo run test --filter=@city-monitor/web -- src/hooks/useMediaQuery.test.ts`
- Run `npx turbo run typecheck` to confirm no type errors
- Manual: resize browser across the 640px breakpoint and confirm tiles toggle expanded state
