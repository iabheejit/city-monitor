# Disable Hamburg

Hamburg is not ready for users. Multiple tiles return empty/null, transit API is offline, and many features are Berlin-only. Rather than investing in Hamburg parity now, disable it entirely so users can't reach it.

## Changes

### 1. Remove Hamburg from city picker — `packages/web/src/components/CityPicker.tsx`

Remove Hamburg from the city selection UI. Users should only see Berlin.

### 2. Redirect Hamburg routes — `packages/web/src/App.tsx` or router config

If someone navigates to `/hamburg` directly (bookmark, old link), redirect to `/berlin`.

### 3. Server: Set ACTIVE_CITIES to berlin only — environment / config

Ensure `ACTIVE_CITIES` env var only includes `berlin`. The server should skip Hamburg cron jobs and not serve Hamburg endpoints.

### 4. Keep Hamburg code intact

Don't delete Hamburg config, city files, or conditional logic. Just make it unreachable. When Hamburg is ready in the future, re-enabling it should be a config change, not a code change.

## Scope

- 2-3 files modified
- No new dependencies, no migration
