# Nagpur API Probe Report

Generated: 2026-04-30T10:32:07.768Z

| ID | Dataset | Status | Total | Notes |
|---|---|---|---:|---|
| agmarknet-mandi | Daily mandi crop prices (AGMARKNET) | LIVE_OK | 55 | Data available |
| cpcb-realtime-aqi | Real-time AQI (CPCB CAAQMS) | LIVE_OK | 28 | Data available |
| msme-udyam | MSME Udyam registrations | LIVE_OK | 272963 | Data available |
| mgnrega-gp | MGNREGA GP-wise employment data | BROKEN | 0 | Meta not found |
| hmis-subdistrict | HMIS sub-district maternal indicators | BROKEN | 0 | Meta not found |
| myscheme-search | MyScheme catalogue API | BROKEN | - | HTTP 401 |
| jjm-fhtc-district | Jal Jeevan Mission – District FHTC progress | BROKEN | 0 | Meta not found |
| jjm-fhtc-alt | JJM FHTC coverage (alt resource) | BROKEN | 0 | Meta not found |
| swachh-survekshan | Swachh Survekshan 2023 city scores | BROKEN | 0 | Meta not found |
| swachh-survekshan-alt | Swachh Survekshan scores (alt resource) | BROKEN | 0 | Meta not found |
| hmis-district-monthly | HMIS district monthly maternal health (NHM MH) | BROKEN | 0 | Meta not found |
| hmis-district-alt | HMIS district health (alt resource) | BROKEN | 0 | Meta not found |
| hospital-nhp-directory | Government hospital directory (NHA) | BROKEN | 0 | Meta not found |
| blood-bank-mh | Licensed blood banks Maharashtra | BROKEN | 0 | Meta not found |
| tb-district-notifications | TB district case notifications (NTEP) | BROKEN | 0 | Meta not found |
| udise-schools-mh | UDISE+ school count Maharashtra | BROKEN | 0 | Meta not found |
| mgnrega-financial-mh | MGNREGA financial progress Maharashtra | BROKEN | 0 | Meta not found |
| e-shram-workers | e-Shram unorganised worker registrations | BROKEN | 0 | Meta not found |
| smart-cities-projects | Smart Cities Mission project tracker | BROKEN | 0 | Meta not found |
| pm-vishwakarma | PM Vishwakarma scheme registrations | BROKEN | 0 | Meta not found |

## Sample Fields

- agmarknet-mandi: state, district, market, commodity, variety, grade, arrival_date, min_price, max_price, modal_price
- cpcb-realtime-aqi: country, state, city, station, last_update, latitude, longitude, pollutant_id, min_value, max_value, avg_value
- msme-udyam: LG_ST_Code, State, LG_DT_Code, District, Pincode, RegistrationDate, EnterpriseName, CommunicationAddress, Activities

## Strategy Gate

1. Probe endpoint health + filter behavior
2. If LIVE_OK, implement server ingestion + read route + bootstrap field
3. Add frontend tile with stale-data fallback
4. Add tests for parser and route behavior
5. Record final status in .plans tracker