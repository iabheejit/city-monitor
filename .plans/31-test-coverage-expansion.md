# Plan 31: Test Coverage Expansion

**Type:** feature (test infrastructure)
**Complexity:** complex (4 bundled items spanning server routes, frontend components, and accessibility audit)

## Context

Current route tests only cover 3 scenarios: cache hit, cache miss (empty response), and 404 for invalid city. None test the DB fallback path (cache miss -> DB read -> return data). The weather-tiles route has no tests at all. BriefingStrip has no rendering test. Several strips use tab-like UI but an ARIA audit is needed.

## Item 1: DB Fallback Tests in Route Test Files

### Problem

Every route handler has a 3-tier read path: cache hit -> DB fallback -> empty default. The existing tests only cover tiers 1 and 3. Tier 2 (DB fallback) is untested across all ~22 route test files.

### Approach

Since `createApp` creates a real `Db` object (or null if no DATABASE_URL), and tests run without a database, we need to test the DB fallback path by creating route instances directly rather than going through `createApp`.

**Strategy: Direct router instantiation with a mock db object.**

1. Create a shared test helper at `packages/server/src/routes/__test-helpers__/mock-db.ts` that exports a `createMockDb()` function returning a minimal mock of `Db` type.
2. In `weather.test.ts`, add a second `describe` block that instantiates `createWeatherRouter(cache, mockDb)` directly on an Express app, bypassing `createApp`. This avoids the full app setup and allows injecting a mock DB.
3. Mock `db/reads.ts` functions using `vi.mock` to control DB responses.

**Test cases for `weather.test.ts` (establishing the pattern):**
- DB returns data when cache is empty -> response includes DB data, cache is populated
- DB throws error when cache is empty -> graceful fallback to empty default
- DB returns null when cache is empty -> empty default response

**Then apply the same pattern to 3 newer route tests:**
- `pollen.test.ts`
- `council-meetings.test.ts`
- `feuerwehr.test.ts`

### Files to Create/Modify

| File | Action |
|---|---|
| `packages/server/src/routes/weather.test.ts` | Add DB fallback describe block (3 new tests) |
| `packages/server/src/routes/pollen.test.ts` | Add DB fallback describe block (3 new tests) |
| `packages/server/src/routes/council-meetings.test.ts` | Add DB fallback describe block (3 new tests) |
| `packages/server/src/routes/feuerwehr.test.ts` | Add DB fallback describe block (3 new tests) |

### Implementation Details

Each new test block follows this structure:

```ts
import { vi } from 'vitest';
import express from 'express';
import { createCache } from '../lib/cache.js';
import { createWeatherRouter } from './weather.js';

// Mock the reads module
vi.mock('../db/reads.js', () => ({
  loadWeather: vi.fn(),
  loadWeatherHistory: vi.fn(),
}));

import { loadWeather } from '../db/reads.js';

describe('Weather API — DB fallback', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  let cache: ReturnType<typeof createCache>;
  const mockDb = {} as any; // routes only pass db to reads functions

  beforeEach(() => {
    cache = createCache();
    app = express();
    // Mount with validateCity middleware equivalent
    app.use('/api/:city', (req, res, next) => { /* city validation */ next(); });
    app.use('/api', createWeatherRouter(cache, mockDb));
  });

  // ... tests using vi.mocked(loadWeather).mockResolvedValue(...)
});
```

The mock DB object can be `{} as any` because route handlers never call db methods directly -- they pass `db` to `db/reads.ts` functions which we mock at the module level.

**Important:** The `vi.mock` call must be at the top level (hoisted by Vitest). Each test uses `vi.mocked(loadWeather).mockResolvedValue(...)` or `.mockRejectedValue(...)`.

City validation: Instead of importing `validateCity` middleware (which pulls in the full config system), use a simple inline middleware that sets `req.params.city` passthrough for known test cities, or just mount the router at a path that includes the city param naturally.

Actually, looking at the route code again: the routes use `getCityConfig(req.params.city)` internally. Since `getCityConfig` is already available (it reads from the static config), routes mounted on Express with `/:city` will work without the `validateCity` middleware -- that middleware just returns 404 early. The route handler itself calls `getCityConfig` and handles the null case. So we can mount the router directly.

## Item 2: Route Tests for `weather-tiles.ts`

### Problem

`weather-tiles.ts` is a tile proxy with no cache or city lookup. It has a module-level `radarPath` variable and makes upstream HTTP requests. It needs a different test approach.

### Approach

Since `radarPath` is module-level state, we need to control it. The router calls `refreshRadarPath()` on creation which makes a fetch to the RainViewer API. We mock `fetch` globally.

**Test cases:**
1. **503 when no radar path** - Create router with fetch mocked to fail, so `radarPath` stays null. Request tile -> 503.
2. **400 for invalid coordinates** - Set radarPath via a successful mock fetch, then request invalid tile coords (z > 7, negative x/y, x >= 2^z).
3. **Coordinate validation edge cases** - Non-integer z/x/y, floating point values.
4. **Successful tile proxy** - Mock both the RainViewer API response (to set radarPath) and the tile fetch to return a PNG buffer.

### Files to Create

| File | Action |
|---|---|
| `packages/server/src/routes/weather-tiles.test.ts` | New file, ~80 lines |

### Implementation Details

```ts
// Mock global fetch
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  // Mock the RainViewer API call that refreshRadarPath() makes on router creation
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      radar: { past: [{ path: '/v2/radar/12345' }] }
    }))
  );

  // Import and create router (triggers refreshRadarPath)
  const { createWeatherTilesRouter } = await import('./weather-tiles.js');
  // ... setup express app
});
```

**Challenge:** The module calls `refreshRadarPath()` at router creation AND sets up `setInterval`. Tests must:
- Mock fetch before importing the module
- Clean up the interval timer in `afterAll` (use `vi.useFakeTimers` or accept the leaked timer)

Alternative approach: Use `vi.mock` for the fetch calls and dynamic import. Since `radarPath` is module-level, tests within the same module share state. Order tests carefully: 503 test first (before radarPath is set), then set it up for remaining tests.

Actually, the cleanest approach: use `vi.hoisted` + dynamic import to control module-level state per describe block. Or accept that `radarPath` is set on import and test 503 via a separate describe with `vi.isolateModules`.

**Decided approach:** Two describe blocks with `vi.isolateModules` for independent module state:
1. Block 1: Mock fetch to fail -> `radarPath` stays null -> test 503
2. Block 2: Mock fetch to succeed -> `radarPath` is set -> test 400 cases and success proxy

## Item 3: BriefingStrip Rendering Test

### Problem

BriefingStrip has no tests. It has 4 visual states: loading, error, content with briefing text, and empty (no briefing).

**Note:** The task mentions "summary tab, headlines tab switching" but BriefingStrip currently has no tabs -- it is a simple content display component. The BriefingStrip shows AI-generated summary text only. The separate NewsStrip has category tabs. The test will cover BriefingStrip's actual states.

### Approach

Follow the pattern established by `TopBar.test.tsx`: create a QueryClient wrapper with `CityProvider`, pre-seed query data, and test rendering.

**Test cases:**
1. **Loading state** - No query data seeded, mock fetch to hang -> renders Skeleton
2. **Error state** - Seed query error -> renders StripErrorFallback with "Briefing"
3. **Content with briefing** - Seed summary data with briefing text -> renders paragraphs
4. **Empty state** - Seed summary data with null/empty briefing -> renders empty message

### Files to Create

| File | Action |
|---|---|
| `packages/web/src/components/strips/BriefingStrip.test.tsx` | New file, ~100 lines |

### Implementation Details

The wrapper needs:
- `QueryClientProvider` with a test `QueryClient`
- `MemoryRouter` (for routing context)
- `CityProvider` with `cityId="berlin"` (BriefingStrip uses `useCityConfig`)

For the loading state: mock `fetch` to return a pending promise (never resolves).
For the error state: use `queryClient.setQueryData` with error metadata or mock fetch to return 500.
For content: seed `['news', 'summary', 'berlin', 'en']` query key with mock data matching `ApiResponse<NewsSummaryData>`.

The `NewsSummaryData` shape (from `useNewsSummary.ts` -> `api.ts`):
```ts
{ briefing: string; generatedAt: string; headlineCount: number; cached: boolean }
```

Wrapped in `ApiResponse`: `{ data: NewsSummaryData; fetchedAt: string }`

For paragraph splitting test: BriefingContent splits on double newlines, so test with multi-paragraph text.

## Item 4: ARIA Tabs Audit

### Problem

Some components may use tab-like UI patterns (clickable buttons that switch content) without proper ARIA `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, and keyboard navigation.

### Audit Results (from grep analysis)

**Components WITH proper ARIA tabs (already good):**
- `NewsStrip.tsx` - `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex`, `useTabKeys`
- `CrisisStrip.tsx` - Same full pattern
- `BudgetStrip.tsx` - Same full pattern
- `EventsStrip.tsx` - Two tablists (source + category), full pattern
- `PoliticalStrip.tsx` - Same full pattern

**Components that use filter/toggle UI but are NOT tab patterns:**
- `CouncilMeetingsStrip.tsx` - Uses a `<select>` dropdown, not tabs. This is semantically correct for a long list of districts. No fix needed.
- `LaborMarketStrip.tsx`, `FeuerwehrStrip.tsx`, `WastewaterStrip.tsx`, `PopulationStrip.tsx` - These use expand/collapse patterns (controlled by parent `Tile`), not tab switching. No fix needed.
- `AppointmentsStrip.tsx`, `WaterLevelStrip.tsx` - Expand/collapse, not tabs.
- `AirQualityStrip.tsx` - Expand/collapse with inline content, not tabs.

**Components that might need attention:**
- `CommandLayout.tsx` - References tab-like button clicks but upon inspection these are tile expand triggers, not content tabs.

### Conclusion

All tab-like UI components already have proper ARIA tabs patterns. The `useTabKeys` hook is consistently used across all 5 tablist components. No fixes needed. This item is a documentation/audit result only.

### Deliverable

No code changes. Record the audit finding in the plan as a completed verification.

## Implementation Order

1. **Item 2** (weather-tiles tests) - Independent, no shared infrastructure needed
2. **Item 1** (DB fallback in weather.test.ts) - Establishes the vi.mock pattern
3. **Item 1 continued** (DB fallback in pollen, council-meetings, feuerwehr) - Follows weather pattern
4. **Item 3** (BriefingStrip test) - Independent frontend work
5. **Item 4** - Already complete (audit above), no implementation needed

## Test Counts

- Item 1: 12 new tests (3 per route x 4 routes)
- Item 2: ~5 new tests
- Item 3: ~4 new tests
- Item 4: 0 (audit only)
- **Total: ~21 new tests across 6 files (5 modified, 1 new)**

## Alternatives Considered

1. **Integration tests with real test DB** for Item 1 - Rejected. Would require PostgreSQL in CI, test database management, and migration infrastructure. Mocking `db/reads.ts` is much simpler and tests the route logic, not the DB layer (which has its own tests in `db/reads.test.ts`).

2. **Testing weather-tiles via `createApp`** for Item 2 - Rejected. `createApp` starts the full server with all routes, crons, and DB connections. The weather-tiles router has module-level side effects (fetch + setInterval) that need isolation.

3. **Testing BriefingStrip tabs** for Item 3 - N/A. BriefingStrip has no tabs. The task description appears to have confused BriefingStrip with NewsStrip. Testing actual component states instead.
