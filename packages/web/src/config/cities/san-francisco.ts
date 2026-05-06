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
  feeds: [],
  dataSources: {
    weather: { provider: 'open-meteo', lat: 37.7749, lon: -122.4194 },
    sfSocrata: {},
    sf511: {},
  },
};
