/**
 * Fuses the distance-ring prior, verified sighting evidence, and search coverage into the
 * remaining-probability surface: for each cell, "how likely is the subject still there, given
 * everything we know and everywhere we've already searched".
 */
import { CONFIG, decayLambdaPerMs } from '../config';
import { haversineM } from './geo';
import { cellCenter, cellsForPoint } from './h3';
import { computePriorCells } from './prior';
import type { CoverageCell } from './coverage';
import type { LatLng, Sighting, SubjectCategory } from '../types';

/** Spatial spread (meters) of a verified sighting's probability bump - reuses the corroboration radius as "how close counts as nearby". */
const DEFAULT_SIGHTING_SIGMA_M = CONFIG.CORROBORATION_RADIUS_M;
/** Bumps are only spread to cells within this many standard deviations (captures ~99.7% of the Gaussian's mass). */
const BUMP_RADIUS_SIGMAS = 3;

export interface ProbabilitySurfaceInput {
  ipp: LatLng;
  category: SubjectCategory;
  verifiedSightings: Sighting[];
  coverage: Map<string, CoverageCell>;
  now: number;
  res?: number;
  lambda?: number;
  sightingSigmaM?: number;
}

function addSightingBump(
  base: Map<string, number>,
  sighting: Sighting,
  now: number,
  lambda: number,
  sigmaM: number,
  res: number,
): void {
  const position: LatLng = { lat: sighting.lat, lng: sighting.lng };
  const recencyWeight = sighting.confidence * Math.exp(-lambda * Math.max(0, now - sighting.observedAt));
  if (recencyWeight <= 0) return;

  const nearbyCells = cellsForPoint(position, sigmaM * BUMP_RADIUS_SIGMAS, res);
  for (const h3 of nearbyCells) {
    const distanceM = haversineM(cellCenter(h3), position);
    const gaussian = Math.exp(-(distanceM * distanceM) / (2 * sigmaM * sigmaM));
    const bump = recencyWeight * gaussian;
    base.set(h3, (base.get(h3) ?? 0) + bump);
  }
}

/** Computes the normalized (sums to 1) remaining-probability surface over H3 cells. */
export function computeProbabilitySurface(input: ProbabilitySurfaceInput): Map<string, number> {
  const res = input.res ?? CONFIG.H3_RES;
  const lambda = input.lambda ?? decayLambdaPerMs();
  const sigmaM = input.sightingSigmaM ?? DEFAULT_SIGHTING_SIGMA_M;

  const base = computePriorCells(input.ipp, input.category, undefined, res);

  for (const sighting of input.verifiedSightings) {
    if (sighting.status !== 'verified') continue;
    addSightingBump(base, sighting, input.now, lambda, sigmaM, res);
  }

  const remaining = new Map<string, number>();
  for (const [h3, probability] of base) {
    const pod = input.coverage.get(h3)?.pod ?? 0;
    remaining.set(h3, probability * (1 - pod));
  }

  const total = Array.from(remaining.values()).reduce((sum, v) => sum + v, 0);
  if (total <= 0) return remaining;

  const normalized = new Map<string, number>();
  for (const [h3, value] of remaining) {
    normalized.set(h3, value / total);
  }
  return normalized;
}
