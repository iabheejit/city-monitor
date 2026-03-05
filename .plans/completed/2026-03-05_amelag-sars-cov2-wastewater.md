# Add SARS-CoV-2 from AMELAG to Wastewater Tile

## Goal

Add SARS-CoV-2 wastewater data from the RKI AMELAG dataset to the existing wastewater tile. Keep Lageso CSV for Flu A/B + RSV. Merge SARS-CoV-2 into the same `WastewaterSummary`.

## Data Source

- **URL:** `https://raw.githubusercontent.com/robert-koch-institut/Abwassersurveillance_AMELAG/main/amelag_einzelstandorte.tsv`
- **Format:** Tab-separated, ~27 MB, ~70 treatment plants nationwide
- **Filter:** `bundesland = "BE"` + pathogen = `SARS-CoV-2` (or the exact column name — need to verify)
- **License:** CC-BY 4.0 (Robert Koch Institut)
- **Update:** Weekly (~Wednesdays), up to 2-week lag from sampling

## Approach

**Extend the existing `ingest-wastewater.ts`** — after Lageso fetch, also fetch AMELAG, stream-parse for Berlin SARS-CoV-2, build one more `WastewaterPathogen`, and merge into the summary.

### Stream Parsing Strategy

The 27 MB file can't be loaded into memory as a string on a 512 MB Render Starter instance. Instead:

1. Use `fetch()` to get the response
2. Read the body as a Node.js `ReadableStream`, pipe through a `TextDecoderStream` and line splitter
3. For each line, split by tab, check `bundesland === 'BE'` and pathogen column matches SARS-CoV-2
4. Keep only matching rows (~50-100 rows out of hundreds of thousands)
5. Peak memory: ~1-2 MB instead of ~80-135 MB

### Merge Logic

The Lageso CSV produces a `WastewaterSummary` with pathogens `[Influenza A, Influenza B, RSV]`. The AMELAG fetch produces a single `WastewaterPathogen` for SARS-CoV-2. Append it to the pathogens array before caching/saving.

AMELAG has its own `sampleDate` which may differ from Lageso's (up to 2 weeks behind). The `WastewaterSummary.sampleDate` stays as the Lageso date. SARS-CoV-2 pathogen gets its own date context — we can add an optional `sampleDate` field to `WastewaterPathogen` for per-pathogen date display when it differs.

## Changes

### 1. `shared/types.ts` — Add optional per-pathogen sampleDate
- Add `sampleDate?: string` to `WastewaterPathogen`

### 2. `shared/schemas.ts` — Update Zod schema
- Add `sampleDate: z.string().optional()` to `WastewaterPathogenSchema`

### 3. `packages/server/src/cron/ingest-wastewater.ts` — Add AMELAG fetch
- Add `AMELAG_TSV_URL` constant
- Add `streamParseAmelagBerlinCovid(response)` function that stream-parses the TSV
- Add `buildCovidPathogen(rows)` that computes value/previousValue/trend/level/history for SARS-CoV-2
- Modify the main function: after Lageso summary is built, fetch AMELAG, build COVID pathogen, merge into summary
- Handle AMELAG failure gracefully (log warning, still cache Lageso-only summary)
- Increase fetch timeout for AMELAG (larger file, maybe 60s)

### 4. `packages/server/src/cron/ingest-wastewater.test.ts` — Add AMELAG tests
- Mock both fetch calls (Lageso CSV + AMELAG TSV)
- Test: SARS-CoV-2 pathogen is merged into summary
- Test: AMELAG failure doesn't break Lageso data
- Test: stream parsing filters correctly

### 5. `packages/web/src/components/strips/WastewaterStrip.tsx` — Add COVID label
- Add `'SARS-CoV-2'` case to `pathogenLabel()` → use translation key
- Show per-pathogen sampleDate in expanded view if it differs from main sampleDate

### 6. i18n — Add translation keys
- `panel.wastewater.covid` for all 4 languages

### 7. `.context/wastewater.md` — Update docs

## Out of Scope

- Hamburg AMELAG data (could be added later using the same stream parser with `bundesland = "HH"`)
- RSV A/B subtypes from AMELAG (we already have RSV from Lageso)
- Separate cron job (unnecessary complexity — one job, two fetches)
