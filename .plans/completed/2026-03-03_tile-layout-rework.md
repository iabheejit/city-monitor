# Tile Layout Rework: Briefing, Transit, Events

## Goal

Three changes to the dashboard tile arrangement:

1. **Briefing** — Move to first position, change to span-1, shorten the AI-generated text, and only feed items labelled as relevant for the city.
2. **Transit** — Change to span-1, collapsed by default (showing max 4 rows), expanded shows up to 8 rows. Switch from card grid to compact rows. Important (high severity) issues first.
3. **Events** — Move to last position (after all other tiles).

## Changes

### 1. Briefing tile (first, span-1, shorter prompt, relevant-only items)

**`packages/server/src/cron/summarize.ts`**
- Add `.filter(item => item.assessment?.relevant !== false)` before the tier filter, so only LLM-assessed-relevant items are fed to the summarizer.
- The `PersistedNewsItem` type from the digest items has an `assessment` field — but the digest has already been filtered by `applyDropLogic()`, which drops `relevant === false` items. So the digest items are already relevant. However, items with no assessment (`assessment === undefined`) are kept by default. The user wants "labelled as relevant" — so we should additionally require `assessment?.relevant === true` (not just "not false"). This filters out items that have no assessment.

**`packages/server/src/lib/openai.ts`** (summarizeHeadlines prompt)
- Change "2-3 sentences" to "1-2 sentences" to produce shorter briefings.

**`packages/web/src/components/layout/CommandLayout.tsx`**
- Move `<Tile title={t('panel.news.briefing')} ...>` to the very first position (before Weather).
- Change `span={2}` to `span={1}`.

### 2. Transit tile (span-1, collapsed, row layout, max 4/8)

**`packages/web/src/components/strips/TransitStrip.tsx`**
- Accept `expanded` prop (boolean) to control how many items to show.
- Collapsed (default): show max 4 entries.
- Expanded: show up to 8 entries.
- Switch from card grid (`grid @xs:grid-cols-2 @lg:grid-cols-3`) to a compact row list layout (vertical stack, no grid columns).
- Keep severity sorting (high first).

**`packages/web/src/components/layout/CommandLayout.tsx`**
- Change transit `span={2}` to `span={1}`.
- Add `expandable` and `defaultExpanded={false}` (collapsed by default).
- Pass `expanded` to `TransitStrip` via render prop.

### 3. Events tile (last position)

**`packages/web/src/components/layout/CommandLayout.tsx`**
- Move the Events tile to after the Political tile (very last in the grid).

## Files to modify

| File | Change |
|---|---|
| `packages/web/src/components/layout/CommandLayout.tsx` | Reorder tiles, change spans |
| `packages/web/src/components/strips/TransitStrip.tsx` | Row layout, accept expanded prop, limit entries |
| `packages/server/src/cron/summarize.ts` | Filter to relevant-only items |
| `packages/server/src/lib/openai.ts` | Shorten prompt to 1-2 sentences |
