# Plan 25: Switch pharmacy ingestion to HTML scraping

## Problem
The aponet.de JSON API (`type=1981` with token) is dead — returns HTML instead of JSON. The hardcoded MagicMirror community token has been revoked and there's no way to auto-refresh it (the token isn't embedded anywhere in the page source).

## Solution
Switch from the JSON API to HTML form-based scraping: POST the same form the website uses, parse pharmacy data from the HTML response using regex. No new dependencies needed.

## Approach

### Step 1: Rewrite `ingest-pharmacies.ts`

Replace `ingestCityPharmacies` with a two-step flow:

1. **`fetchFormTokens()`** — GET the search page, extract TYPO3 hidden fields:
   - `cHash` from the form `action` URL
   - `__referrer[@extension]`, `__referrer[@controller]`, `__referrer[@action]`, `__referrer[arguments]`, `__referrer[@request]`
   - `__trustedProperties`
   - Extract via regex on `name="..." value="..."` patterns within the form

2. **`searchPharmacies(city, formTokens)`** — POST the form with extracted tokens + search params (lat, lon, date, radius=25), parse HTML response

3. **`parsePharmaciesFromHtml(html, cityId)`** — Extract pharmacy entries from `<li class="list-group-item">` elements using regex:
   - `data-id`, `data-latitude`, `data-longitude` from attributes
   - Name from `<h2 class="name">...</h2>`
   - Address from `.strasse`, `.plz`, `.ort` spans
   - Phone from `<a href="tel:...">`
   - Validity from "Notdienst vom DD.MM.YYYY um HH:MM Uhr bis DD.MM.YYYY um HH:MM Uhr" text
   - Distance from `.distanz` badge text (extract number before "km")

**Remove:** `APONET_TOKEN` env var, fallback token, token warning, `AponetPharmacy` interface, JSON parsing logic.

**Keep unchanged:** `createPharmacyIngestion` signature, `formatDateDE`, `parseDateTimeDE` exports, cache key, DB write pattern, error handling per-city, timeout, 6-hour cache TTL.

### Step 2: Add `parsePharmaciesFromHtml` tests

Add tests for the new HTML parsing function using realistic HTML snippets. Test:
- Single pharmacy entry parsing
- Multiple entries
- Missing optional fields (no phone, no distance)
- Malformed entries (missing lat/lon → skipped)

Keep existing `parseDateTimeDE` and `formatDateDE` tests.

### Step 3: Update context doc

Update `.context/new-data-sources.md` if it mentions the aponet token, to reflect the new scraping approach.

## Files to change
- `packages/server/src/cron/ingest-pharmacies.ts` — rewrite data fetching + add HTML parser
- `packages/server/src/cron/ingest-pharmacies.test.ts` — add HTML parsing tests

## Regex strategy

Use a single regex to split the HTML into `<li>` chunks, then per-chunk regexes to extract fields. This mirrors the pattern used in `ingest-appointments.ts` for calendar scraping.

Key regexes:
- Split: `/<li\s+class="list-group-item"[\s\S]*?<\/li>/g`
- Lat/lon: `data-latitude="([^"]+)".*?data-longitude="([^"]+)"`
- Name: `<h2[^>]*class="name"[^>]*>(.*?)<\/h2>`
- Address: `class="strasse">(.*?)<\/span>.*?class="plz">(.*?)<\/span>\s*<span class="ort">(.*?)<\/span>`
- Phone: `href="tel:([^"]+)"`
- Validity: `Notdienst vom (\d{2}\.\d{2}\.\d{4}) um (\d{2}:\d{2}) Uhr bis (\d{2}\.\d{2}\.\d{4}) um (\d{2}:\d{2}) Uhr`
- Distance: `(\d+[.,]\d+)\s*km`

## Not changing
- Cache keys, DB schema, route handlers, shared types — all unchanged
- No new dependencies
