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
      stateName: 'Maharashtra',
      districtName: 'Nagpur',
    },
    myScheme: {
      stateName: 'Maharashtra',
    },
    cpcbAqi: {
      cityName: 'Nagpur',
    },
    msme: {
      districtName: 'NAGPUR',
    },
    nfhs5: {
      resourceId: 'cf80173e-fece-439d-a0b1-6e9cb510593d',
      districtFilter: 'Nagpur',
    },
    jjm: {
      resourceId: '0e89eba1-bbc2-4c85-bdad-32b8071e0b60',
      stateName: 'Maharashtra',
      districtName: 'Nagpur',
    },
  },
};
