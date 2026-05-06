import type { CityConfig } from '@city-monitor/shared';

export const sanFrancisco: CityConfig = {
  id: 'san-francisco',
  name: 'San Francisco',
  country: 'US',
  coordinates: { lat: 37.7749, lon: -122.4194 },
  boundingBox: { north: 37.83, south: 37.70, east: -122.35, west: -122.52 },
  timezone: 'America/Los_Angeles',
  languages: ['en', 'es', 'zh'],
  map: {
    center: [-122.4194, 37.7749],
    zoom: 12,
    minZoom: 10,
    maxZoom: 17,
    bounds: [
      [-122.52, 37.70],
      [-122.35, 37.83],
    ],
  },
  theme: { accent: '#E8800A' },
  feeds: [
    {
      name: 'SF Standard',
      url: 'https://sfstandard.com/feed/',
      tier: 1,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'Mission Local',
      url: 'https://missionlocal.org/feed/',
      tier: 1,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'ABC7 News',
      url: 'https://abc7news.com/feed/',
      tier: 2,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'SFist',
      url: 'https://sfist.com/feed/',
      tier: 2,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'KQED News',
      url: 'https://www.kqed.org/news/feed',
      tier: 1,
      type: 'gov',
      lang: 'en',
    },
  ],
  dataSources: {
    weather: { provider: 'open-meteo', lat: 37.7749, lon: -122.4194 },
    sfSocrata: {
      appToken: process.env.SF_SOCRATA_APP_TOKEN,
    },
    sf511: {
      apiKey: process.env.SF_511_API_KEY,
    },
  },
};
