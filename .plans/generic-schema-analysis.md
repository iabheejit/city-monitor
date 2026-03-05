# Architecture Analysis: Typed Tables vs Generic Document Schema

## The Question

Replace 25 domain-specific tables with a single generic table:

```sql
-- Proposed
CREATE TABLE snapshots (
  id       SERIAL PRIMARY KEY,
  city_id  TEXT NOT NULL,
  type     TEXT NOT NULL,       -- 'weather', 'transit', 'news', ...
  fetched_at TIMESTAMPTZ DEFAULT now(),
  data     JSONB NOT NULL
);
CREATE INDEX ON snapshots (city_id, type, fetched_at DESC);
```

## Current Reality: You're Already 65% Document-Store

The 25 tables fall into three structural families. The answer is different for each.

### Family 1: Snapshot tables (16 tables) — Already generic

`weather`, `water_levels`, `appointments`, `budget`, `construction`, `traffic`, `pharmacy`, `aed`, `social_atlas`, `wastewater`, `bathing`, `labor_market`, `population`, `feuerwehr`, `pollen`, `noise_sensors`, `council_meetings`

These are effectively `(id, city_id, fetched_at, jsonb_blob)` already. The only difference between them is the JSONB column name (`sites` vs `stations` vs `data`). Every read is `ORDER BY fetched_at DESC LIMIT 1`. Every write is a plain `INSERT`.

**A generic table would change nothing meaningful here.** You'd swap `db.insert(budgetSnapshots)` for `db.insert(snapshots).values({ type: 'budget', ... })`. Same query, same performance, same code volume.

### Family 2: Multi-row batch tables (3 tables) — Complications start

`transit_disruptions`, `air_quality_grid`, `nina_warnings`

These store **individual records** with typed columns:
- `transit_disruptions`: `line`, `severity`, `station`, `lat/lon`, `resolved`, `validFrom/validUntil`
- `air_quality_grid`: `lat`, `lon`, `europeanAqi`, `station`, `url`
- `nina_warnings`: `warningId`, `version`, `severity`, `headline`, unique constraint on `(cityId, warningId, version)`

In a generic table:
- `nina_warnings` UPSERT on `(cityId, warningId, version)` becomes a partial unique index on JSONB: `UNIQUE((data->>'warningId'), (data->>'version')) WHERE type = 'nina'`. Fragile, Drizzle doesn't support this natively, and it's invisible to TypeScript.
- `loadAqiHistory` uses `AVG(europeanAqi)` in SQL. Becomes `AVG((data->>'europeanAqi')::int)` — works but can't use a typed index, and the Postgres optimizer can't push down predicates as efficiently.

### Family 3: Hash-keyed UPSERT tables (4 tables) — Real problems

`news_items`, `events`, `safety_reports`, `political_districts`

These need **typed columns for deduplication**:
- UPSERT on `(city_id, hash)` with selective column updates: update `category`, `importance`, `lat/lon` but **not** `title`, `url`, `publishedAt`
- This is the core feature: re-encountering the same news article updates its AI assessment without touching its identity fields

In a generic table, you can't do selective JSONB field updates in an `ON CONFLICT` clause. You'd need one of:
1. A `UNIQUE` index on `(city_id, (data->>'hash')) WHERE type = 'news'` + raw SQL for partial JSONB merge — loses all Drizzle type safety
2. A read-merge-write pattern — loses atomicity, adds race conditions
3. Keep these as separate typed tables — which defeats the purpose

### Special tables (2) — Can't be genericized

- `geocode_lookups`: No `city_id` at all. Global persistent cache with `UNIQUE(query)`.
- `ai_summaries`: Different lifecycle — grouped by `generatedAt`, per-language rows.

## What A Generic Schema Actually Saves

Per new data source, a Drizzle table definition is ~5-10 lines:

```ts
export const pollenSnapshots = pgTable('pollen_snapshots', {
  id: serial('id').primaryKey(),
  cityId: text('city_id').notNull(),
  data: jsonb('data').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
}, (t) => [index('pollen_city_idx').on(t.cityId)]);
```

This is the **only** thing a generic schema eliminates. Everything else remains identical:

| Integration point | Generic schema helps? |
|---|---|
| Table definition (5 lines) | Yes — eliminated |
| Cron job (~50-200 lines) | No |
| Write function (~5 lines) | Marginal — generic `save(type, data)` |
| Read function (~10 lines) | Marginal — generic `load(type)` |
| Zod validation schema | No — still needed per domain |
| Cache key | No |
| Cache warming entry | No |
| API route | No |
| Frontend hook | No |
| Frontend component | No |
| Shared TypeScript type | No |
| Tests | No |

You need ~15 integration points per data source. The table definition is the smallest one.

## Multi-City Flexibility

> "Different cities will have different data sources, and even for overlaps like weather the structure might be different"

This is the strongest argument for genericization, but the current schema already handles it:

- **Different data sources per city**: Berlin has `feuerwehr`, Hamburg doesn't. The cron job only runs for configured cities. The table exists but is empty for Hamburg. The cache key returns `null`. The frontend hides the tile. No schema change needed.
- **Different structures for same domain**: Berlin and Hamburg weather both go into `weather_snapshots`. The JSONB payload can differ — Zod validation handles structural variance. If Hamburg weather had a completely different shape, you'd want a different Zod schema and a different type... at which point it's a different data source anyway.

A generic table doesn't change this. The complexity lives in the **code** that ingests, validates, and renders data — not in the table definition.

## Performance Considerations

| Aspect | 25 tables | 1 generic table |
|---|---|---|
| Table scan for latest row | Scans only weather rows | Scans all rows, filtered by `WHERE type = 'weather'` |
| Index size | Small per-table indexes | One large composite index |
| VACUUM/autovacuum | Independent per table | Single table — long-running vacuums |
| Table bloat from append-only writes | Isolated per domain | Accumulates across all domains |
| pg_dump/restore | Granular per table | All-or-nothing |
| Connection-level locks | No contention between domains | Potential HOT chain contention |

At current scale (~25 cron jobs, each writing 1-50 rows every 5-60 min), this doesn't matter. At 50 cities × 25 sources, the single table would hold millions of rows and autovacuum becomes a real concern.

PostgreSQL table partitioning (`PARTITION BY LIST (type)`) would solve this — but it literally recreates the 25-table structure under the hood, with extra complexity.

## What Would Actually Help

If the goal is reducing per-source boilerplate, the highest-leverage changes are:

### 1. Generic read/write helpers (keep typed tables)

```ts
// Generic snapshot read — works for all 16 snapshot tables
function loadSnapshot<T>(db, table, cityId, schema: ZodType<T>): Promise<DbResult<T> | null> {
  const rows = await db.select().from(table)
    .where(eq(table.cityId, cityId))
    .orderBy(desc(table.fetchedAt)).limit(1);
  return rows[0] ? { data: schema.parse(rows[0].data), fetchedAt: rows[0].fetchedAt } : null;
}

// Generic snapshot write
function saveSnapshot(db, table, cityId, data) {
  return db.insert(table).values({ cityId, data });
}
```

This eliminates the 16 repetitive `loadXxx` / `saveXxx` functions without changing the schema. The typed tables remain for the 9 tables that need typed columns.

### 2. Table factory (keep typed tables, reduce definition boilerplate)

```ts
function snapshotTable(name: string, jsonbField = 'data') {
  return pgTable(name, {
    id: serial('id').primaryKey(),
    cityId: text('city_id').notNull(),
    [jsonbField]: jsonb(jsonbField).notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  }, (t) => [index(`${name}_city_idx`).on(t.cityId)]);
}

export const budgetSnapshots = snapshotTable('budget_snapshots');
export const pollenSnapshots = snapshotTable('pollen_snapshots');
// ... one-liners
```

### 3. City config declares available data sources

```ts
const BERLIN_SOURCES = ['weather', 'transit', 'news', 'feuerwehr', ...];
const HAMBURG_SOURCES = ['weather', 'transit', 'news', ...];
```

Bootstrap endpoint only returns keys for configured sources. Frontend only renders configured tiles. This is already partially implemented via the `ACTIVE_CITIES` env var and Berlin-only guards.

## Verdict

**Keep the typed tables.** The current schema is a pragmatic hybrid that's already mostly document-store where it makes sense, with typed columns only where they earn their keep (UPSERT dedup, SQL aggregation, unique constraints).

The "25 tables" count sounds heavy, but 16 of them are trivial 4-column tables that could be defined as one-liners with a factory function. The real complexity — and the real per-source cost — lives in cron jobs, Zod schemas, cache warming, API routes, and frontend components. The table definition is the cheapest part of the stack.

A generic schema would save ~5 lines per snapshot source at the cost of:
- Breaking UPSERT patterns for news/events/safety (the most complex tables)
- Losing Drizzle type inference
- Requiring JSONB-path indexes and raw SQL for constraints
- Creating a single large table that complicates vacuuming and partitioning

**Recommended instead:** Generic `loadSnapshot`/`saveSnapshot` helpers + a table factory function. Same DX improvement, zero architectural risk.
