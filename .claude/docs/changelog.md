# Changelog

## v1.0.0 — 2026-04-29

### Added
- Nagpur (Maharashtra, India) as third city in City Monitor
- AGMARKNET mandi prices ingestion (daily, TTL 12h) — `ingest-mandi.ts`
- MGNREGA employment data ingestion (daily, TTL 24h) — `ingest-mgnrega.ts`
- MyScheme civic schemes ingestion (daily, TTL 24h) — `ingest-myscheme.ts`
- MandiStrip, MgnregaStrip, SchemesStrip frontend tiles
- `useMandiPrices`, `useMgnrega`, `useMyScheme` React Query hooks
- Hindi (hi) and Marathi (mr) full locale files
- Saffron-orange map accent for Nagpur: `[data-city='nagpur'] { --accent: #FF6600 }`
- `MandiSummary`, `MgnregaSummary`, `SchemeCatalogue`, `SchemeEntry` shared types + Zod schemas
- 11 unit tests for `parseAgmarknetRecords` and `parseMgnregaRecord`
- `.context/nagpur.md` documentation
- `DATA_GOV_IN_API_KEY` env var in render.yaml

### Changed
- `ingest-safety.ts` refactored to use `CITY_DISTRICTS` map + `police.districts` config field
- CLAUDE.md updated to reflect Berlin, Hamburg, Nagpur
- Upstream merge: 74 commits from OdinMB/city-monitor integrated

### Fixed
- `data-retention.test.ts`: updated mock setup for `.where().returning()` chain (upstream pattern change)
