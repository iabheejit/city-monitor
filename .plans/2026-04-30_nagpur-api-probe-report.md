# Nagpur API Probe Report

Generated: 2026-04-30T08:11:12.118Z

| ID | Dataset | Status | Total | Notes |
|---|---|---|---:|---|
| agmarknet-mandi | Daily mandi crop prices (AGMARKNET) | LIVE_OK | 55 | Data available |
| cpcb-realtime-aqi | Real-time AQI (CPCB CAAQMS) | LIVE_OK | 28 | Data available |
| msme-udyam | MSME Udyam registrations | LIVE_OK | 272963 | Data available |
| mgnrega-gp | MGNREGA GP-wise employment data | BROKEN | 0 | Meta not found |
| myscheme-search | MyScheme catalogue API | BROKEN | - | HTTP 401 |

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