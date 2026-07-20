/** The MapLibre + deck.gl canvas: renders coverage/probability surfaces, rings, sightings, and search-next cells. */
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { resolveBasemapStyle } from './basemap';
import { distanceRings } from './geometry';
import {
  buildCoverageLayer,
  buildIppLayer,
  buildProbabilityLayer,
  buildRingsLayer,
  buildSearchNextLayer,
  buildSightingsLayer,
} from './layers';
import type { CoverageCell, RankedCell } from '../signals';
import type { LatLng, Sighting, SubjectCategory } from '../types';

export interface LayerToggles {
  coverage: boolean;
  probability: boolean;
  rings: boolean;
  sightings: boolean;
  searchNext: boolean;
}

export const DEFAULT_LAYER_TOGGLES: LayerToggles = {
  coverage: true,
  probability: true,
  rings: true,
  sightings: true,
  searchNext: true,
};

const DEFAULT_CENTER: LatLng = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 1.5;
const IPP_ZOOM = 13;

export interface MapCanvasProps {
  ipp: LatLng | null;
  category: SubjectCategory;
  coverage: Map<string, CoverageCell>;
  probability: Map<string, number>;
  searchNext: RankedCell[];
  sightings: Sighting[];
  toggles: LayerToggles;
}

/**
 * Full-screen MapLibre map with a single persistent deck.gl `MapboxOverlay` (interleaved,
 * so deck.gl layers render inline with MapLibre's own WebGL context rather than a stacked
 * canvas). Layers are rebuilt from the current surfaces/toggles and pushed via
 * `overlay.setProps` on every relevant change, never by recreating the map or overlay.
 */
export function MapCanvas({ ipp, category, coverage, probability, searchNext, sightings, toggles }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hasFitBoundsRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveBasemapStyle(),
      center: [ipp?.lng ?? DEFAULT_CENTER.lng, ipp?.lat ?? DEFAULT_CENTER.lat],
      zoom: ipp ? IPP_ZOOM : DEFAULT_ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // The map/overlay are created once and mutated thereafter via refs; recreating them on
    // every prop change would destroy interaction state (pan/zoom) for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the viewport to the outermost distance ring the first time the IPP becomes known.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ipp || hasFitBoundsRef.current) return;
    hasFitBoundsRef.current = true;

    const outermost = distanceRings(ipp, category).at(-1);
    const bounds = new maplibregl.LngLatBounds([ipp.lng, ipp.lat], [ipp.lng, ipp.lat]);
    for (const point of outermost?.polygon ?? []) {
      bounds.extend([point.lng, point.lat]);
    }
    map.fitBounds(bounds, { padding: 48, animate: false });
  }, [ipp, category]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const rings = ipp ? distanceRings(ipp, category) : [];
    overlay.setProps({
      layers: [
        buildCoverageLayer(coverage, toggles.coverage),
        buildProbabilityLayer(probability, toggles.probability),
        buildRingsLayer(rings, toggles.rings),
        buildSightingsLayer(sightings, toggles.sightings),
        buildSearchNextLayer(searchNext, toggles.searchNext),
        ...(ipp ? [buildIppLayer(ipp, true)] : []),
      ],
    });
  }, [ipp, category, coverage, probability, searchNext, sightings, toggles]);

  return <div ref={containerRef} className="map-canvas" />;
}
