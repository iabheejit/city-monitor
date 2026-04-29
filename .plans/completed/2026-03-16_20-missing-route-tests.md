# Plan: Add Missing Route Tests

**Type:** bugfix (test coverage gap)
**Complexity:** simple
**Date:** 2026-03-16

## Context

The task requested tests for `construction.ts` and `noise-sensors.ts`, but `noise-sensors.test.ts` already exists with the standard 3-test pattern. The only route file truly missing a test is `construction.ts`. (There is also `weather-tiles.ts` without tests, but that route has a fundamentally different pattern — it proxies tiles, has no cache/city pattern, and makes external HTTP calls, so it is out of scope for this task.)

## Plan

### File 1: `packages/server/src/routes/construction.test.ts` (new)

Follow the exact 3-test pattern from `council-meetings.test.ts` / `pollen.test.ts`:

1. **Test setup:** Import from vitest, create app with `skipScheduler: true`, listen on port 0, store `baseUrl` and `appContext`.

2. **Test 1 — empty response (no cache):**
   - `GET /api/berlin/construction`
   - Expect 200, `body.data` is `[]`, `body.fetchedAt` is `null`
   - Note: construction returns `{ data: [], fetchedAt: null }` when empty (not `null` like some routes).

3. **Test 2 — cache hit:**
   - Insert mock `ConstructionSite[]` into cache using key `berlin:construction:sites` (from `CK.constructionSites('berlin')`).
   - Import `ConstructionSite` from `@city-monitor/shared`.
   - Mock data: one site with `id`, `subtype: 'construction'`, `street`, `description`, `isFuture: false`, `geometry`.
   - `GET /api/berlin/construction`
   - Expect 200, `body.data` has length 1, verify `body.data[0].street` matches mock, `body.fetchedAt` is a string.

4. **Test 3 — 404 for unknown city:**
   - `GET /api/unknown/construction`
   - Expect 404.

5. **Teardown:** Close server in `afterAll`.

### No other files changed

The task is a single new test file. No modifications to existing code.
