# LangChain Migration, Briefing Overhaul, Map Clustering

## Goals

1. Replace OpenAI SDK with LangChain's `ChatOpenAI` + `.withStructuredOutput(zodSchema)` for all LLM calls
2. Change briefing to use the 25 most recent stories with importance > 0.5, passing descriptions too
3. Add MapLibre native clustering for news + safety markers to handle overlapping coordinates

## 1. LangChain Migration (`packages/server/src/lib/openai.ts`)

### Dependencies

```
npm install @langchain/openai zod --workspace=packages/server
npm uninstall openai --workspace=packages/server
```

### Changes

Replace the lazy `OpenAI` singleton with a lazy `ChatOpenAI` singleton. All three exported functions migrate:

**`filterAndGeolocateNews`** — Currently uses `response_format: { type: 'json_object' }` + `JSON.parse` + manual validation. Replace with:

```ts
const FilterResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    relevant_to_city: z.boolean(),
    category: z.string(),
    importance: z.number(),
    locationLabel: z.string().optional(),
  })),
});

const structured = getModel(filterModel).withStructuredOutput(FilterResultSchema, { includeRaw: true });
const result = await structured.invoke([systemMsg, userMsg]);
// result.parsed — Zod-validated object
// result.raw.usage_metadata — token counts for tracking
```

Post-processing (category validation, importance clamping) remains the same. Geocoding loop unchanged.

**`geolocateReports`** — Same pattern:

```ts
const GeoResultSchema = z.object({
  items: z.array(z.object({
    index: z.number(),
    locationLabel: z.string().optional(),
  })),
});
```

**`summarizeHeadlines`** — Currently plain text. Migrate to structured output:

```ts
const BriefingSchema = z.object({
  briefing: z.string().describe('The bullet-point briefing text'),
});
```

This gives consistent parsing and removes the need to handle raw content extraction.

**Usage tracking** — `withStructuredOutput({ includeRaw: true })` returns `result.raw` which is an `AIMessage` with `usage_metadata.input_tokens` / `output_tokens`. The existing `usage` accumulator and `getUsageStats()` stay the same, just read from the new location.

**Model helpers** — Replace the singleton pattern:

```ts
function getModel(modelName: string): ChatOpenAI {
  return new ChatOpenAI({ model: modelName });
}
```

`ChatOpenAI` handles its own caching internally, so no need for a module-level singleton.

### Files Changed

- `packages/server/src/lib/openai.ts` — full rewrite
- `packages/server/package.json` — add `@langchain/openai`, `zod`; remove `openai`

### Files Unchanged

All callers (`ingest-feeds.ts`, `ingest-safety.ts`, `summarize.ts`, `health.ts`) keep the same function signatures. The migration is fully internal to `openai.ts`.

## 2. Briefing Overhaul (`packages/server/src/cron/summarize.ts`)

### Current behavior
- Top 10 headlines, tier ≤ 2, importance ≥ 0.3
- Only titles sent to LLM

### New behavior
- Up to 25 most recent items with importance > 0.5 (no tier filter)
- Titles + descriptions sent for richer context
- System prompt updated for more items (~120 words, 6-8 bullet points)

### Changes

In `summarize.ts`:
- `TOP_HEADLINES = 25`
- Filter: `(item.importance ?? 0) > 0.5` (drop tier filter)
- Pass items (not just titles) to `summarizeHeadlines`
- Change `summarizeHeadlines` signature to accept `Array<{ title: string; description?: string }>` instead of `string[]`

In `openai.ts` (`summarizeHeadlines`):
- Accept items with title + description
- Format user message as: `1. Title — Description snippet...`
- Update system prompt: "From the stories below, write 6-8 bullet points (~120 words)"
- Hash top-5 titles for dedup (unchanged)

### Files Changed

- `packages/server/src/lib/openai.ts` — updated signature + prompt
- `packages/server/src/cron/summarize.ts` — new filter logic, pass descriptions

## 3. Map Spiderify (`packages/web/src/components/map/CityMap.tsx`)

### Problem
Many news items geocode to "Berlin" (city center) producing identical lat/lon. With `icon-allow-overlap: true`, they stack invisibly and only the top one is interactive.

### Solution
Interactive spiderfying. Markers at identical coordinates stack normally. Hovering shows a count hint ("N items - click to expand"). Clicking expands the group outward in a ~400m radius circle with connecting spider legs. Clicking the map background collapses the expansion.

### Implementation

**Module-level state per marker type:**
- `SpiderState` — groups map, original coordinates, currently expanded group key
- `SpiderHandlerSet` — stored handler references for cleanup on data updates

**Key functions:**
- `initSpiderState(fc, state)` — tags features with `_groupKey` + `_groupSize`, stores original coords
- `computeSpiderPositions(features, state)` — computes expanded/collapsed positions + spider leg lines
- `updateSpiderSources(map, features, state, ...)` — applies position changes to GeoJSON sources
- `addSpiderHandler(map, hset, ...)` — registers handlers with cleanup tracking
- `cleanupSpiderHandlers(map, hset)` — removes all handlers before re-registering

**Per marker type, two sources + custom event handlers:**
1. Spider line source (`{type}-spider-lines`) — starts empty, populated on expansion
2. Point marker source (`{type}-markers`) — positions updated dynamically via `setData()`
3. Custom click/mouseenter/mouseleave handlers (no `registerPopupHandlers`) with expansion + popup logic

### Files Changed

- `packages/web/src/components/map/CityMap.tsx` — spider infrastructure + `updateNewsMarkers` + `updateSafetyMarkers`

## Decisions

- **Briefing data**: Titles + descriptions (richer LLM context)
- **Overlap strategy**: Two-pronged — (1) improved LLM prompt pushes for district-level location specificity + post-processing discards bare city name labels; (2) interactive spiderfying with click-to-expand, count badges, and adaptive radius for residual overlap
- **SDK strategy**: Full replacement (remove `openai`, use only `@langchain/openai` + `zod`)

## Test Plan

- Unit test: `openai.test.ts` — mock `ChatOpenAI.withStructuredOutput`, verify Zod schemas parse correctly, verify usage tracking reads from `usage_metadata`
- Unit test: `summarize.ts` — verify new filter (importance > 0.5, no tier gate, 25 items)
- Existing tests: `ingest-feeds.test.ts`, `ingest-safety.test.ts` — update mocks for new return shape if needed
- Visual: Playwright screenshot of map with clustered news markers at city zoom level
