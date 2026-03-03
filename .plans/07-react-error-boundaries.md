# React Error Boundaries & Error States

Prevent component crashes from taking down the entire page. Add meaningful error UI to data-fetching components.

## Changes

### 1. App-level error boundary — `packages/web/src/App.tsx`

Add a top-level `<ErrorBoundary>` wrapping the router. On crash, show a full-page error screen with:
- "Something went wrong" message (translated)
- A "Reload" button that calls `window.location.reload()`
- The error message in a collapsible details section (for bug reports)

Use `react-error-boundary` (lightweight, well-maintained) or implement a simple class component.

### 2. Map error boundary — `packages/web/src/components/layout/CommandLayout.tsx`

Wrap the lazy-loaded `CityMap` in its own `<ErrorBoundary>`. Map initialization failures (WebGL issues, tile loading errors) should show a fallback UI without crashing the dashboard tiles.

Fallback: "Map unavailable" message with a retry button.

### 3. Strip error states — all strip components

Currently, if a React Query hook errors, strips show nothing (the loading skeleton disappears, and the component renders empty or crashes).

**Fix:** Add error handling to the shared strip pattern:
- If `isError` is true, show a compact error message: "Failed to load [domain]" with a "Retry" button that calls `refetch()`
- Keep the tile header visible so the user knows what failed

This can be implemented as a shared `<StripErrorFallback>` component used across all strips.

### 4. Date parsing safety — multiple strip files

**Problem:** `new Date(dateStr)` in WeatherStrip, EventsStrip, and format-time.ts can produce `Invalid Date` silently.

**Fix:** Create a `safeDateParse(input: string): Date | null` utility that returns null for invalid dates. Callers display a fallback string (e.g., "—") instead of "Invalid Date".

## Decision

Use `react-error-boundary` library. Well-maintained, ~2KB, provides `useErrorBoundary` hook for imperative error throwing from async code.

## Testing

- Unit test: ErrorBoundary renders fallback when child throws
- Unit test: StripErrorFallback renders retry button
- Unit test: safeDateParse returns null for invalid input
- Integration: verify map crash doesn't crash dashboard

## Scope

- 1 new component (`StripErrorFallback`)
- 1 new utility (`safeDateParse`)
- ~15 strip files modified (add error state)
- 2-3 layout files modified (add boundaries)
- Optionally 1 new dependency (react-error-boundary)
