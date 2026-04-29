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
  feeds: [],
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
