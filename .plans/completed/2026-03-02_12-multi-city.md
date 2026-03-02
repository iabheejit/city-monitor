# Milestone 12 — Multi-City

**Goal:** Add a second city and verify the "one config file" promise.

**Depends on:** Berlin dashboard fully working (milestones 01–11).

---

## Steps

### 1. Add Hamburg config

Create `config/cities/hamburg.ts` (both server and web packages):

```typescript
export const hamburg: CityConfig = {
  id: 'hamburg',
  name: 'Hamburg',
  country: 'DE',
  coordinates: { lat: 53.5511, lon: 9.9937 },
  boundingBox: { north: 53.74, south: 53.39, east: 10.33, west: 9.73 },
  timezone: 'Europe/Berlin',
  languages: ['de', 'en'],
  map: {
    center: [9.9937, 53.5511],
    zoom: 11,
    minZoom: 9,
    maxZoom: 17,
    bounds: [[9.7, 53.35], [10.35, 53.75]],
  },
  theme: { accent: '#004B93' },
  feeds: [
    { name: 'NDR Hamburg', url: '...', tier: 1, type: 'mainstream', lang: 'de' },
    { name: 'Hamburger Abendblatt', url: '...', tier: 2, type: 'mainstream', lang: 'de' },
    { name: 'MOPO', url: '...', tier: 2, type: 'mainstream', lang: 'de' },
    // ...
  ],
  dataSources: {
    weather: { provider: 'open-meteo', lat: 53.5511, lon: 9.9937 },
    transit: { provider: 'hafas', operatorId: 'HVV' },
    police: { provider: 'rss', url: 'https://www.polizei.hamburg/...' },
  },
};
```

### 2. Update `ACTIVE_CITIES`

Set `ACTIVE_CITIES=berlin,hamburg` in environment. Server auto-discovers both configs.

### 3. Frontend routing

Add city selection to the app:

```
/           → city picker or redirect to default city
/berlin     → Berlin dashboard
/berlin/*   → Berlin panels
/hamburg    → Hamburg dashboard
```

Use `react-router` with a `/:cityId` parameter. The `CityProvider` reads the param and loads the matching config.

### 4. City picker

If the user visits `/`, show a simple city picker:
- Berlin card (with accent color + brief description)
- Hamburg card
- Each links to `/{cityId}`

### 5. Verify data isolation

Confirm that:
- Feed ingestion runs for both cities independently
- Summarization uses city-specific prompts
- All Postgres queries filter by `city_id`
- Cache keys are properly prefixed (`berlin:news:digest` vs `hamburg:news:digest`)
- A failure in one city's ingestion doesn't affect the other
- No cross-city data leaks in bootstrap or digest endpoints

### 6. Subdomain support (optional)

If you want `berlin.citydash.app` and `hamburg.citydash.app`:
- Read `Host` header on the server to determine city
- Configure DNS wildcards
- Frontend reads from `window.location.hostname`

This is optional — path-based routing (`/berlin`, `/hamburg`) works fine for v1.

---

## Done when

- [ ] Hamburg config exists and is auto-loaded
- [ ] `GET /api/hamburg/news/digest` returns Hamburg-specific news
- [ ] Hamburg dashboard shows Hamburg weather, news, transit
- [ ] Berlin dashboard is unaffected
- [ ] City picker at `/` shows both cities
- [ ] Adding the config file + updating `ACTIVE_CITIES` was the only code change
- [ ] Health endpoint lists both cities
