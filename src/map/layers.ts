/** Pure builders that turn computed surfaces + visibility toggles into deck.gl layer instances. */
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { coverageColor, ippColor, probabilityColor, ringColor, searchNextColor, sightingColor } from './colors';
import type { DistanceRing } from './geometry';
import type { CoverageCell, RankedCell } from '../signals';
import type { LatLng, Sighting } from '../types';

const IPP_RADIUS_M = 20;
const SIGHTING_RADIUS_M = 18;

/** Decayed coverage (probability-of-detection) surface, one hexagon per H3 cell. */
export function buildCoverageLayer(coverage: Map<string, CoverageCell>, visible: boolean) {
  return new H3HexagonLayer<CoverageCell>({
    id: 'coverage',
    data: Array.from(coverage.values()),
    visible,
    pickable: true,
    filled: true,
    stroked: false,
    extruded: false,
    getHexagon: (d) => d.h3,
    getFillColor: (d) => coverageColor(d.pod),
    updateTriggers: {
      getFillColor: [coverage],
    },
  });
}

/** Remaining-probability heat surface, normalized against its own max value. */
export function buildProbabilityLayer(probability: Map<string, number>, visible: boolean) {
  const data = Array.from(probability.entries()).map(([h3, value]) => ({ h3, value }));
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);

  return new H3HexagonLayer<{ h3: string; value: number }>({
    id: 'probability',
    data,
    visible,
    pickable: true,
    filled: true,
    stroked: false,
    extruded: false,
    getHexagon: (d) => d.h3,
    getFillColor: (d) => probabilityColor(d.value, max),
    updateTriggers: {
      getFillColor: [probability],
    },
  });
}

/** p25/p50/p75/p95 distance rings from the IPP, rendered as unfilled outlines. */
export function buildRingsLayer(rings: DistanceRing[], visible: boolean) {
  const features = rings.map((ring) => ({
    type: 'Feature' as const,
    properties: { label: ring.label, radiusM: ring.radiusM },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[...ring.polygon.map((p) => [p.lng, p.lat]), [ring.polygon[0].lng, ring.polygon[0].lat]]],
    },
  }));

  return new GeoJsonLayer({
    id: 'distance-rings',
    data: { type: 'FeatureCollection', features },
    visible,
    filled: false,
    stroked: true,
    getLineColor: ringColor(),
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
  });
}

/** Sighting markers, colored/faded by verification status. */
export function buildSightingsLayer(sightings: Sighting[], visible: boolean) {
  return new ScatterplotLayer<Sighting>({
    id: 'sightings',
    data: sightings,
    visible,
    pickable: true,
    stroked: true,
    radiusUnits: 'meters',
    getPosition: (d) => [d.lng, d.lat],
    getRadius: SIGHTING_RADIUS_M,
    getFillColor: (d) => sightingColor(d.status),
    getLineColor: [30, 30, 30, 180],
    getLineWidth: 1.5,
    lineWidthUnits: 'pixels',
    updateTriggers: {
      getFillColor: [sightings],
    },
  });
}

/** The Initial Planning Point marker. */
export function buildIppLayer(ipp: LatLng, visible: boolean) {
  return new ScatterplotLayer<LatLng>({
    id: 'ipp',
    data: [ipp],
    visible,
    pickable: true,
    stroked: true,
    radiusUnits: 'meters',
    getPosition: (d) => [d.lng, d.lat],
    getRadius: IPP_RADIUS_M,
    getFillColor: ippColor(),
    getLineColor: [255, 255, 255, 230],
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
  });
}

/** "Search here next" cells, highest-ranked-first, rendered as outlined hexagons. */
export function buildSearchNextLayer(searchNext: RankedCell[], visible: boolean) {
  return new H3HexagonLayer<RankedCell>({
    id: 'search-next',
    data: searchNext,
    visible,
    pickable: true,
    filled: false,
    stroked: true,
    extruded: false,
    getHexagon: (d) => d.h3,
    getLineColor: searchNextColor(),
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1.5,
    updateTriggers: {
      getLineColor: [searchNext],
    },
  });
}
