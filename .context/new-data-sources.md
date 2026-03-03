# New Data Sources Research (2026-03-03)

Research into emergency and city services data availability for Berlin.

## 1. Construction Works / Roadworks — HIGHLY FEASIBLE

### VIZ Berlin (Primary)
- **URL:** `https://api.viz.berlin.de/daten/baustellen_sperrungen.json`
- **Format:** GeoJSON FeatureCollection (Point + LineString geometries)
- **Auth:** None
- **License:** dl-de-by-2.0 (attribution required: "Digitale Plattform Stadtverkehr Berlin")
- **Updates:** Hourly, editorially curated
- **Coordinates:** WGS84 (EPSG:4326), directly usable with MapLibre

**Data fields per feature:**
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `tstore` | ISO 8601 | Last update time |
| `subtype` | string | `"Baustelle"`, `"Sperrung"`, `"Storung"`, `"Unfall"` |
| `severity` | string | e.g. `"keine Sperrung"` or null |
| `validity.from` / `validity.to` | string | Duration (`"DD.MM.YYYY HH:mm"`) |
| `direction` | string | e.g. `"Beidseitig"` |
| `icon` | string | `"baustelle"`, `"sperrung"`, `"warnung"` |
| `is_future` | boolean | Whether event is upcoming |
| `street` | string | Street name with district |
| `section` | string | Affected section |
| `content` | string | Description of work/disruption |

**WFS alternative:** `https://api.viz.berlin.de/geoserver/mdhwfs/wfs?REQUEST=GetFeature&SERVICE=WFS&VERSION=1.1.0&typename=baustellen_sperrungen&outputFormat=application/json&SRSNAME=EPSG:4326`

**Note:** Dataset is editorially curated — contains events "of particular traffic interest," not every minor roadwork.

### Autobahn API (Federal Highways)
- **Base URL:** `https://verkehr.autobahn.de/o/autobahn/{road}/services/roadworks`
- **Berlin highways:** A100 (city ring), A10 (outer ring), A111, A113, A114, A115
- **Format:** JSON with coordinates + LineString geometries
- **Auth:** None. **Docs:** https://autobahn.api.bund.dev/
- **Also available:** `/services/closure`, `/services/warning`

---

## 2. Water Levels (PEGELONLINE) — HIGHLY FEASIBLE

- **API Base:** `https://www.pegelonline.wsv.de/webservices/rest-api/v2`
- **Auth:** None. **License:** DL-DE-Zero (completely free, no attribution required)
- **Updates:** Every 15 minutes
- **Docs:** https://pegelonline.wsv.de/webservice/dokuRestapi

### Key Berlin Stations
| Station | UUID | Water Body |
|---------|------|------------|
| Berlin-Mühlendamm UP | `09e15cf6-f155-4b76-b92f-6c260839121c` | Spree (city center) |
| Berlin-Charlottenburg UP | `d89eb759-58c4-43f4-9fe4-e6a21af23f5c` | Spree (west) |
| Berlin-Köpenick | `47d3e815-c556-4e1b-93de-9fe07329fb00` | Spree (southeast) |
| Berlin-Spandau UP | `2c68509c-bf1e-4866-9ec4-b26b231e5e04` | Havel (west) |
| Berlin-Schmöckwitz | `6b595707-8c47-4bc7-a803-dbc327775c26` | Dahme (south) |

### API Endpoints
```
# All 5 stations with current measurement + reference values (single call)
GET /stations.json?ids={uuid1},{uuid2},...&includeTimeseries=true&includeCurrentMeasurement=true&includeCharacteristicValues=true

# Single station current measurement
GET /stations/{uuid}/W/currentmeasurement.json

# Historical (max 30 days)
GET /stations/{uuid}/W/measurements.json?start=P30D
```

### Data Points
- `value` — water level in cm
- `stateMnwMhw` — relation to mean low/high water (`"low"`, `"normal"`, `"high"`)
- `stateNswHsw` — relation to extreme low/high water
- Characteristic values: NNW, MNW, MW, MHW, HHW with year of occurrence

**No forecasts for Berlin** (rivers are heavily regulated). Forecasts exist for Hamburg (Elbe).

---

## 3. Berliner Feuerwehr — FEASIBLE (Daily Stats)

- **Source:** GitHub Open Data — `https://github.com/Berliner-Feuerwehr/BF-Open-Data`
- **License:** CC-BY-4.0
- **Format:** CSV files updated daily

### Datasets
- **Per-mission:** `mission_data_set_open_data_YYYY.csv` — date, type, dispatch code, severity, district, response time, units
- **Daily aggregates:** `BFw_mission_data_daily.csv` — total calls by category, response time stats

### Limitations
- **District-level location only** — no street addresses or coordinates
- Daily update cadence (0-24h stale)
- CSV grows throughout the year (13+ MB)

**Best for:** KPI tiles (daily call count, avg response time, type breakdown). Not suitable for map pins.

---

## 4. Hospital Emergency Rooms — PARTIALLY FEASIBLE

### Static Layer (Easy)
- **WFS endpoint:** `https://gdi.berlin.de/services/wfs/krankenhaeuser?service=WFS&version=2.0.0&request=GetFeature&typeNames=krankenhaeuser:plankrankenhaeuser&outputFormat=application/json&srsName=EPSG:4326`
- **License:** DL-DE-Zero (free)
- **Data:** 64 plan hospitals with coordinates, bed counts, addresses, districts
- **ER hospitals:** 37 total (6 Notfallzentren + 31 Notfallkrankenhäuser) — cross-reference with official list at berlin.de/sen/gesundheit

### Real-Time Wait Times (Scraping Only)
**Vivantes** (8 hospitals, ~1/3 of Berlin ER capacity) publishes live data:
- Average wait time (rolling 6h), patients waiting, ambulance arrivals, critical cases
- Server-side rendered HTML — no JSON API
- No other hospital group publishes ER data
- IVENA (the real dispatching system) is closed to public

---

## 5. AED/Defibrillator Locations — FEASIBLE

### OpenStreetMap (Primary)
- **127 AEDs** in Berlin via Overpass API
- **Query:** `[out:json];area["name"="Berlin"]["admin_level"="4"]->.s;node["emergency"="defibrillator"](area.s);out body;`
- **Data completeness:** indoor/outdoor 93%, location description 81%, operator 34%, opening hours 29%
- Free, no auth, no rate limits (reasonable use)

### Definetz Registry (Optional Enhancement)
- **661+ AEDs** in Berlin
- Webservice available — free for non-commercial use, requires bilateral agreement
- Contact: Friedrich.Noelle@definetz.com

---

## 6. Utility Outages — NOT FEASIBLE

None of Berlin's utilities offer public APIs or structured data for outages:
- **Stromnetz Berlin** — text status page + @Stromstoerung X account (paid API needed)
- **GASAG/NBB** — phone-only
- **Berliner Wasserbetriebe** — phone-only
- **BEW (district heating)** — text status page

Major outages are rare. Not worth the engineering effort.

---

## 7. Emergency Doctors (116117) — NEEDS RESEARCH

The 116117/KV Berlin service has a web search tool but no documented public API. Further investigation needed.

---

## 8. Crisis Hotlines / Shelters — STATIC DATA ONLY

No APIs exist. Recommended approach: curated static JSON file with quarterly manual review.

### Key Services
| Service | Phone | Hours |
|---------|-------|-------|
| Berliner Krisendienst (9 regional offices) | 030 390 63-XX | Daily 16-24h |
| BIG Hotline (domestic violence) | 030 611 03 00 | 24/7 |
| TelefonSeelsorge | 0800-111 0 111/222 | 24/7 |
| Kinder-/Jugendtelefon | 116 111 | Mon-Sat 14-19h |
| Kindernotdienst | 030 61 00 61 | 24/7 |
| Jugendnotdienst | 030 61 00 62 | 24/7 |

---

## Priority Ranking

| # | Feature | Feasibility | Value | Effort | API Quality |
|---|---------|------------|-------|--------|-------------|
| 1 | **Construction/Roadworks** | High | High | Low | GeoJSON, no auth, hourly |
| 2 | **Water Levels** | High | Medium | Low | REST/JSON, no auth, 15-min |
| 3 | **AED Locations** | High | Medium | Low | Overpass API, no auth |
| 4 | **Hospital ER Map** (static) | High | Medium | Low | WFS GeoJSON, no auth |
| 5 | **Feuerwehr Stats** | Medium | Low-Med | Medium | CSV from GitHub, daily |
| 6 | **Crisis Services** | High (static) | Medium | Very Low | Static JSON file |
| 7 | **Hospital Wait Times** | Low (scraping) | Medium | High | HTML scraping, fragile |
| 8 | **Utility Outages** | Very Low | Low | High | No data feeds exist |
