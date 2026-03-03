# LLM News Classification + Importance Scoring

## Goal

Replace the keyword-based classifier with LLM-assigned categories + importance scores. Rename `relevant` → `relevant_to_city`. Drop `confidence`. Add `importance` (0–1). Show only recent, important, city-relevant news on the map and tile.

## Changes

### 1. LLM Prompt — `openai.ts`

Update `filterAndGeolocateNews` to return `category`, `relevant_to_city`, `importance` (and `locationLabel`). Drop `confidence`. The prompt should include guidance on importance calibration:

- **0.0–0.2**: Routine filler — minor openings, non-notable events, generic announcements
- **0.3–0.4**: Mildly noteworthy — local infrastructure, small policy changes, cultural events
- **0.5–0.6**: Significant — major transit disruptions, notable crime, political decisions affecting the city
- **0.7–0.8**: Very important — large-scale emergencies, major policy changes, significant safety incidents
- **0.9–1.0**: Critical/breaking — city-wide emergencies, disasters, events with immediate public impact

Categories in the prompt: `local`, `politics`, `transit`, `culture`, `crime`, `economy`, `sports` (not `weather` — weather items exist but are hidden on the frontend).

Update `FilteredItem` and `LlmFilterResult` interfaces accordingly.

### 2. Delete classifier — `classifier.ts`

Delete `packages/server/src/lib/classifier.ts` and its test file `classifier.test.ts`. Remove all imports of `classifyHeadline`.

### 3. Feed ingestion — `ingest-feeds.ts`

- In `fetchOneFeed`: remove `classifyHeadline` call. Use `feed.category` if set (the RBB Polizei override → `'crime'`), otherwise use `'local'` as initial placeholder. The LLM will assign the real category in step 5.
- Update `NewsItem` interface: `relevant?: boolean` → no change yet (stays as field name in the public type); internally the LLM returns `relevant_to_city`
- Add `importance?: number` to `NewsItem`
- In `applyLlmFilter`: apply the LLM-returned `category` to the item (override the placeholder). Apply `importance`.
- In `applyDropLogic`: filter on `relevant_to_city === false` (same logic, just renamed field internally). Also expose `importance` in the output.
- Update sorting: sort by `importance` descending (after relevance filtering), with recency as tiebreaker.

### 4. DB Schema — `schema.ts`

- Rename column `relevant` → `relevant` (keep column name for now, avoid migration). The field semantically means "relevant to city".
- Remove `confidence` column (or leave it nullable and stop writing to it — simpler than a migration)
- Add `importance` column: `real('importance')`

### 5. DB writes/reads — `writes.ts`, `reads.ts`

- `saveNewsItems`: write `importance` from assessment, stop writing `confidence`
- `loadNewsItems`: read `importance`, skip `confidence` in the returned assessment
- `PersistedNewsItem` / `NewsItemAssessment`: add `importance?: number`, remove `confidence`

### 6. Prior assessments — `ingest-feeds.ts`

- `loadPriorAssessments`: carry over `category` (LLM-assigned) and `importance` alongside `relevant` and `location`. When a known item is re-used from DB, apply the stored LLM category (not the placeholder).

### 7. Frontend — `api.ts`, `NewsStrip.tsx`, `CityMap.tsx`

- `NewsItem` in `api.ts`: add `importance?: number`
- `NewsStrip.tsx`: sort visible items by importance (desc), then recency. The MAX_ITEMS cap already limits to 10.
- `CityMap.tsx`: filter `newsItems` to only show items above an importance threshold (e.g. ≥ 0.3) for map markers, preventing clutter.

### 8. Tests

- Delete `classifier.test.ts`
- Update `ingest-feeds.test.ts`: remove references to classifier categories in test fixtures. Update mock LLM return values to include `category` and `importance`. Update assessment-related assertions.

## Not Changing

- Feed-level `category` override (RBB Polizei → `crime`) — stays as a hard override
- Summarization prompt (`summarizeHeadlines`) — separate concern
- Safety/police ingestion — separate pipeline
- DB migration — just add columns, leave old ones nullable
