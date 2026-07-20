/** Thin, pure wrappers around h3-js for converting geo points/segments into H3 cells. */
import { cellToBoundary, cellToLatLng, getHexagonEdgeLengthAvg, gridDisk, latLngToCell, UNITS } from 'h3-js';
import { CONFIG } from '../config';
import { haversineM } from './geo';
import type { LatLng } from '../types';

/** Average edge length (meters) of an H3 cell at the given resolution. */
export function edgeLengthM(res: number): number {
  return getHexagonEdgeLengthAvg(res, UNITS.m);
}

/** The H3 cell index containing the given point. */
export function pointToCell(p: LatLng, res: number = CONFIG.H3_RES): string {
  return latLngToCell(p.lat, p.lng, res);
}

/** The lat/lng center of an H3 cell. */
export function cellCenter(h3: string): LatLng {
  const [lat, lng] = cellToLatLng(h3);
  return { lat, lng };
}

/** The vertex ring of an H3 cell, for rendering as a polygon. */
export function cellBoundary(h3: string): LatLng[] {
  return cellToBoundary(h3).map(([lat, lng]) => ({ lat, lng }));
}

/** All cells within `radiusM` of a point: the point's own cell plus a grid disk sized to cover the radius. */
export function cellsForPoint(p: LatLng, radiusM: number, res: number = CONFIG.H3_RES): string[] {
  const origin = pointToCell(p, res);
  const k = Math.max(1, Math.ceil(radiusM / edgeLengthM(res)));
  const disk = gridDisk(origin, k);
  return Array.from(new Set([origin, ...disk]));
}

/**
 * All cells within `radiusM` of any point along the a->b segment. Samples the segment at
 * spacing approximately equal to the cell edge length (so consecutive samples' coverage discs
 * always overlap, leaving no gap), then unions `cellsForPoint` for each sample.
 */
export function cellsForSegment(a: LatLng, b: LatLng, radiusM: number, res: number = CONFIG.H3_RES): string[] {
  const distanceM = haversineM(a, b);
  const spacing = edgeLengthM(res);
  const steps = Math.max(1, Math.ceil(distanceM / spacing));

  const cells = new Set<string>();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const sample: LatLng = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    for (const cell of cellsForPoint(sample, radiusM, res)) {
      cells.add(cell);
    }
  }
  return Array.from(cells);
}
