# Plan: Small Code Quality Fixes (Batch of 5)

**Type:** refactor
**Complexity:** simple
**Files affected:** 5

## Changes

### 1. Replace raw `console.error` in CityMap.tsx (C2)

**File:** `packages/web/src/components/map/CityMap.tsx:754`

Change `console.error('[political] GeoJSON swap error:', e)` to `console.warn('[political] GeoJSON swap error:', e)`.

Rationale: This is a non-fatal error in a catch block after an AbortError check. A GeoJSON swap failure is recoverable (the map just keeps the old layer), so `warn` is appropriate. The frontend has no structured logger -- `console.warn` is the convention for non-critical issues.

### 2. Move LOCATIONIQ_TOKEN to call-time read (M1)

**File:** `packages/server/src/lib/geocode.ts:64`

Move `const LOCATIONIQ_TOKEN = process.env.LOCATIONIQ_TOKEN;` from module scope into the `geocodeLocationIQ()` function body (line 76). This ensures the token is read at call time, not at module-load time, which matters if env vars are set after the module is first imported (e.g., in tests or late config).

The guard `if (!LOCATIONIQ_TOKEN) return null;` on line 77 stays the same but now reads the freshly-fetched value.

### 3. Add null/undefined guard in saveSnapshot (N8)

**File:** `packages/server/src/db/writes.ts:40-42`

Add a guard at the top of `saveSnapshot`:

```ts
async function saveSnapshot(db: Db, cityId: string, type: SnapshotType, data: unknown): Promise<void> {
  if (data == null) return;                 // guard: skip insert for null/undefined
  await db.insert(snapshots).values({ cityId, type, data });
}
```

Using `== null` catches both `null` and `undefined`. A silent return is correct here -- callers already handle missing data upstream; this is a defensive last-resort guard.

### 4. Add comment explaining serial geocoding loop (I6)

**File:** `packages/server/src/lib/openai.ts:241`

Add a comment above the `for` loop:

```ts
// Serial loop is intentional: Nominatim enforces a strict 1 QPS rate limit,
// so parallel requests would be rejected. See geocode.ts for the rate-limiter.
for (const item of allLlmItems) {
```

### 5. Add comment documenting bootstrap has no DB fallback (M8)

**File:** `packages/server/src/routes/news.ts:107`

Add a comment above the bootstrap endpoint:

```ts
// Bootstrap endpoint: returns all cached city data in one response.
// NOTE: Unlike individual routes (e.g., /news/digest, /news/summary), bootstrap
// is cache-only with no DB fallback. If the cache is cold, slots return null.
router.get('/:city/bootstrap', (req, res) => {
```

## Verification

Run typecheck to ensure no type errors are introduced:
```bash
npm run typecheck
```

No functional behavior changes -- these are all defensive guards, log-level adjustments, and documentation comments.
