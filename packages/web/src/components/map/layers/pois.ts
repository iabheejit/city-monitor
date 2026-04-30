/**
 * OSM POI circle markers for Nagpur (hospitals, schools, fire stations, police, parks, etc.)
 */

import maplibregl from 'maplibre-gl';
import type { OsmPoi } from '../../../lib/api.js';
import { registerPopupHandlers, type PopupContentFn } from '../popups.js';

const SOURCE_ID = 'osm-pois';
const LAYER_ID = 'osm-poi-circles';
const LABEL_LAYER_ID = 'osm-poi-labels';

const AMENITY_COLORS: Record<string, string> = {
  hospital: '#ef4444',
  clinic: '#f97316',
  pharmacy: '#ec4899',
  school: '#3b82f6',
  university: '#6366f1',
  fire_station: '#f59e0b',
  police: '#1d4ed8',
  park: '#22c55e',
};

const DEFAULT_COLOR = '#9ca3af';

function getColor(amenity: string): string {
  return AMENITY_COLORS[amenity] ?? DEFAULT_COLOR;
}

function poisToGeoJSON(pois: OsmPoi[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        amenity: p.amenity,
        color: getColor(p.amenity),
      },
    })),
  };
}

export function updateOsmPoiMarkers(map: maplibregl.Map, pois: OsmPoi[], isDark: boolean): void {
  for (const id of [LABEL_LAYER_ID, LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

  if (pois.length === 0) return;

  const geojson = poisToGeoJSON(pois);
  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': 6,
      'circle-color': ['get', 'color'] as unknown as maplibregl.ExpressionSpecification,
      'circle-opacity': 0.85,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': isDark ? '#1f2937' : '#ffffff',
    },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'] as unknown as maplibregl.ExpressionSpecification,
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': isDark ? '#e5e7eb' : '#111827',
      'text-halo-color': isDark ? '#111827' : '#ffffff',
      'text-halo-width': 1.5,
    },
  });

  const getContent: PopupContentFn = (e) => {
    if (!e.features?.length) return null;
    const p = e.features[0].properties!;
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
    const color = getColor(p.amenity as string);
    const name = p.name || p.amenity;
    const html = `<div style="font-size:13px;max-width:200px">
      <div style="font-weight:600;margin-bottom:2px">${name}</div>
      <div style="font-size:11px;color:${color};text-transform:capitalize">${p.amenity}</div>
      <div style="font-size:10px;color:${isDark ? '#888' : '#999'};margin-top:4px">OpenStreetMap</div>
    </div>`;
    return { html, lngLat: coords };
  };
  registerPopupHandlers(map, LAYER_ID, getContent, { offset: 10, maxWidth: '220px' });
}
