/**
 * Statistical "Lost Person Behavior" distance-ring prior: the probability the subject is found
 * at a given straight-line distance from the Initial Planning Point (IPP), derived from
 * historical search-and-rescue outcome distributions (ISRID-style distance quantiles).
 */
import { CONFIG } from '../config';
import { haversineM } from './geo';
import { cellCenter, cellsForPoint, edgeLengthM } from './h3';
import type { LatLng, SubjectCategory } from '../types';

interface DistanceQuantiles {
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

// APPROXIMATE placeholder values — MUST be replaced with vetted ISRID / Koester
// "Lost Person Behavior" data before real deployment. Units: meters from the IPP.
export const DISTANCE_QUANTILES: Record<SubjectCategory, DistanceQuantiles> = {
  autistic_child: { p25: 190, p50: 396, p75: 805, p95: 2011 },
  dementia: { p25: 230, p50: 520, p75: 1150, p95: 3200 },
  child_1_6: { p25: 240, p50: 480, p75: 880, p95: 2000 },
  child_7_12: { p25: 400, p50: 900, p75: 1800, p95: 4000 },
  hiker: { p25: 800, p50: 1800, p75: 4000, p95: 9700 },
  despondent: { p25: 350, p50: 850, p75: 2000, p95: 5000 },
  other: { p25: 500, p50: 1200, p75: 2800, p95: 6500 },
};

/** Control points of the piecewise-linear radial CDF for a category, sorted by distance. */
function cdfControlPoints(category: SubjectCategory): Array<[distanceM: number, cumulative: number]> {
  const q = DISTANCE_QUANTILES[category];
  return [
    [0, 0],
    [q.p25, 0.25],
    [q.p50, 0.5],
    [q.p75, 0.75],
    [q.p95, 0.95],
    [1.5 * q.p95, 1],
  ];
}

/** Probability the subject is found within `distanceM` of the IPP, per the category's prior. */
export function radialCdf(category: SubjectCategory, distanceM: number): number {
  const points = cdfControlPoints(category);
  if (distanceM <= points[0][0]) return 0;
  const [lastX, lastY] = points[points.length - 1];
  if (distanceM >= lastX) return lastY;

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (distanceM >= x0 && distanceM <= x1) {
      const t = (distanceM - x0) / (x1 - x0);
      return Math.min(1, Math.max(0, y0 + t * (y1 - y0)));
    }
  }
  return 1;
}

/** Slope of the piecewise-linear CDF (dF/dd) at `distanceM`, i.e. the 1D radial density. */
function radialCdfSlope(category: SubjectCategory, distanceM: number): number {
  const points = cdfControlPoints(category);
  const clamped = Math.min(Math.max(distanceM, points[0][0]), points[points.length - 1][0]);

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      return (y1 - y0) / (x1 - x0);
    }
  }
  return 0;
}

/**
 * 2D radial probability density at a given distance from the IPP: the 1D ring density
 * (dF/dd) spread over the circumference of the ring at that distance (area grows with 2*pi*d).
 * A cell-edge-length floor on `d` avoids a divide-by-zero blowup exactly at the IPP.
 */
export function priorDensityAtDistance(category: SubjectCategory, distanceM: number): number {
  const epsilon = edgeLengthM(CONFIG.H3_RES);
  const slope = radialCdfSlope(category, distanceM);
  return slope / (2 * Math.PI * Math.max(distanceM, epsilon));
}

/** All H3 cells within the category's practical search radius (1.5x the 95th percentile) of the IPP. */
export function candidateCellsAroundIPP(
  ipp: LatLng,
  category: SubjectCategory,
  res: number = CONFIG.H3_RES,
): string[] {
  const maxRadiusM = 1.5 * DISTANCE_QUANTILES[category].p95;
  return cellsForPoint(ipp, maxRadiusM, res);
}

/** Per-cell prior probability of the subject's location, normalized to sum to 1 across cells. */
export function computePriorCells(
  ipp: LatLng,
  category: SubjectCategory,
  cells?: string[],
  res: number = CONFIG.H3_RES,
): Map<string, number> {
  const candidateCells = cells ?? candidateCellsAroundIPP(ipp, category, res);
  const densities = candidateCells.map((h3) => priorDensityAtDistance(category, haversineM(cellCenter(h3), ipp)));
  const total = densities.reduce((sum, d) => sum + d, 0);

  const map = new Map<string, number>();
  if (total <= 0) {
    const uniform = candidateCells.length > 0 ? 1 / candidateCells.length : 0;
    for (const h3 of candidateCells) map.set(h3, uniform);
    return map;
  }
  candidateCells.forEach((h3, i) => map.set(h3, densities[i] / total));
  return map;
}
