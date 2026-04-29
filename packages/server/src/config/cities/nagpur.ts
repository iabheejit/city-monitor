import type { CityConfig } from '@city-monitor/shared';

export const nagpur: CityConfig = {
  id: 'nagpur',
  name: 'Nagpur',
  country: 'IN',
  coordinates: { lat: 21.1458, lon: 79.0882 },
  boundingBox: { north: 21.28, south: 21.03, east: 79.21, west: 78.97 },
  timezone: 'Asia/Kolkata',
  languages: ['en', 'hi', 'mr'],
  map: {
    center: [79.0882, 21.1458],
    zoom: 12,
    minZoom: 10,
    maxZoom: 17,
    bounds: [
      [78.90, 20.90],
      [79.30, 21.35],
    ],
  },
  theme: { accent: '#FF6600' },
  feeds: [
    {
      name: 'Times of India Nagpur',
      url: 'https://timesofindia.indiatimes.com/rssfeeds/7503718.cms',
      tier: 1,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'Hindustan Times Nagpur',
      url: 'https://www.hindustantimes.com/rss/nagpur/rssfeed.xml',
      tier: 1,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'Nagpur Today',
      url: 'https://www.nagpurtoday.in/feed',
      tier: 2,
      type: 'mainstream',
      lang: 'en',
    },
    {
      name: 'Lokmat Nagpur',
      url: 'https://www.lokmat.com/nagpur/feed/',
      tier: 2,
      type: 'mainstream',
      lang: 'mr',
    },
    {
      name: 'Maharashtra Times Nagpur',
      url: 'https://maharashtratimes.com/rss/nagpur.cms',
      tier: 2,
      type: 'mainstream',
      lang: 'mr',
    },
  ],
  dataSources: {
    weather: { provider: 'open-meteo', lat: 21.1458, lon: 79.0882 },
    agmarknet: {
      stateId: 'Maharashtra',
      districtName: 'Nagpur',
    },
    mgnrega: {
      stateCode: '27',
      districtCode: '529',
    },
    myScheme: {
      stateCode: 'MH',
    },
  },
};
