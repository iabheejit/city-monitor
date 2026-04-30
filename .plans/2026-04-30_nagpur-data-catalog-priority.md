# Nagpur Data Catalog - City Monitor Integration Priority

Date: 2026-04-30

Goal: translate the raw dataset list into a City Monitor style execution queue.

## Status Legend

- LIVE_OK: confirmed live and usable via API with Nagpur or Maharashtra filtering
- LIVE_NEEDS_VERIFY: likely live, endpoint/filters need exact validation
- CSV_STATIC: file-based, periodic ingestion (not real-time)
- REQUEST_ONLY_OR_GAP: appears listed but access is restricted or API not usable

## Already Integrated (keep and improve)

1. AGMARKNET mandi prices (daily)
- Status: LIVE_OK
- City Monitor module: Mandi tile + trend strip
- Current notes: already wired for Nagpur

2. CPCB real-time AQI
- Status: LIVE_OK
- City Monitor module: AQ tile + map markers
- Current notes: already wired for Nagpur

3. MSME Udyam registrations
- Status: LIVE_OK
- City Monitor module: economic tile (top sectors + recent registrations)
- Current notes: already wired for Nagpur

## Tier 1 Next Integrations (highest dashboard value)

1. HMIS monthly report (district, Maharashtra)
- Status: LIVE_NEEDS_VERIFY
- City Monitor module: Health System tile (OPD/IPD, deliveries, immunization)
- Freshness: monthly
- Why next: high civic value, measurable monthly trend

2. HMIS sub-district and key indicators (taluka level)
- Status: LIVE_NEEDS_VERIFY
- City Monitor module: Health sub-district comparison tile
- Freshness: monthly
- Why next: stronger Nagpur-local granularity than district-only views

3. Jal Jeevan Mission household tap coverage
- Status: LIVE_NEEDS_VERIFY
- City Monitor module: Water access tile (coverage and functionality)
- Freshness: frequent
- Why next: directly citizen-relevant service metric

4. MGNREGA GP-wise employment and finance
- Status: LIVE_NEEDS_VERIFY
- City Monitor module: Employment tile (person-days, wages, pending)
- Freshness: frequent
- Why next: labor + welfare visibility

## Tier 2 Integrations (valuable but secondary)

1. UDISE school infrastructure
- Status: LIVE_NEEDS_VERIFY
- Module: Education infrastructure tile

2. UDISE enrollment and PTR metrics
- Status: LIVE_NEEDS_VERIFY
- Module: Education outcomes tile

3. Hospital directory
- Status: LIVE_NEEDS_VERIFY
- Module: Health infrastructure map/list

4. Blood bank directory (Maharashtra)
- Status: LIVE_NEEDS_VERIFY
- Module: Emergency health access layer

5. Swachh Survekshan and SBM urban waste metrics
- Status: LIVE_NEEDS_VERIFY
- Module: Sanitation and waste performance tile

6. Smart Cities mission project tracker (Nagpur)
- Status: LIVE_NEEDS_VERIFY
- Module: Project progress tile

## Tier 3 (CSV or slower-moving baselines)

1. Crop-wise area, production, yield
- Status: CSV_STATIC
- Module: agri context tile (historical trend)

2. Rainfall historical district datasets (IMD / Maharashtra)
- Status: CSV_STATIC
- Module: climate baseline trend tile

3. Agricultural census holdings (2015-16)
- Status: CSV_STATIC
- Module: landholding context tile

4. NFHS-5 district factsheets
- Status: CSV_STATIC
- Module: health-demography baseline tile

5. Census 2011 literacy
- Status: CSV_STATIC
- Module: literacy baseline tile

6. CGWB groundwater levels
- Status: CSV_STATIC
- Module: groundwater trend tile

7. Minor irrigation census
- Status: CSV_STATIC
- Module: irrigation baseline tile

8. CWC reservoir storage bulletin
- Status: CSV_STATIC
- Module: reservoir status tile

## Low Confidence / Known Gap Group

1. District budget and expenditure APIs
- Status: REQUEST_ONLY_OR_GAP
- Reason: repeatedly reported unavailable as open API

2. State budget APIs (machine-consumable)
- Status: REQUEST_ONLY_OR_GAP
- Reason: inconsistent and often null across states

3. Dam storage APIs outside specific state portals
- Status: REQUEST_ONLY_OR_GAP
- Reason: common listing mismatch vs practical API access

## Practical City Monitor Build Order

Sprint A
1. HMIS district monthly
2. HMIS sub-district key indicators

Sprint B
1. Jal Jeevan Mission coverage
2. MGNREGA validation and reliability hardening

Sprint C
1. UDISE infrastructure
2. Hospital and blood bank directories

## Validation Checklist Per Dataset

1. Confirm endpoint responds in under 10s
2. Confirm filter fields and case sensitivity (example: district values often require uppercase)
3. Confirm non-zero Nagpur payload
4. Confirm deterministic keys and parse rules
5. Define freshness + cron schedule + cache TTL
6. Add to server snapshot type and bootstrap response
7. Add frontend tile with stale-data fallback state

## Notes

- Keep MapLibre as primary map renderer.
- Use Bhuvan selectively as an optional India overlay where specific layers are validated and stable.
- Prefer vendored GeoJSON for critical boundaries to avoid runtime failures from third-party GIS endpoints.
