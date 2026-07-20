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
/**
 * Upper bound on how much of the blended surface's mass a verified sighting can claim, even at
 * full confidence/recency. Keeps the distance prior visible everywhere instead of being
 * annihilated by a sighting bump that (pre-normalization) is orders of magnitude larger than any
 * single prior cell.
 */
const DEFAULT_ALPHA_MAX = 0.8;

export interface ProbabilitySurfaceInput {
  ipp: LatLng;
  category: SubjectCategory;
  verifiedSightings: Sighting[];
  coverage: Map<string, CoverageCell>;
  now: number;
  res?: number;
  lambda?: number;
  sightingSigmaM?: number;
  /** Overrides the default cap (0.8) on sighting-influence weight in the prior/sighting blend. */
  alphaMax?: number;
}

/** Confidence discounted by how long ago the sighting was observed; 0 once fully decayed. */
function sightingWeight(sighting: Sighting, now: number, lambda: number): number {
  return sighting.confidence * Math.exp(-lambda * Math.max(0, now - sighting.observedAt));
}

function addSightingBump(
  surface: Map<string, number>,
  sighting: Sighting,
  weight: number,
  sigmaM: number,
  res: number,
): void {
  const position: LatLng = { lat: sighting.lat, lng: sighting.lng };
  const nearbyCells = cellsForPoint(position, sigmaM * BUMP_RADIUS_SIGMAS, res);
  for (const h3 of nearbyCells) {
    const distanceM = haversineM(cellCenter(h3), position);
    const gaussian = Math.exp(-(distanceM * distanceM) / (2 * sigmaM * sigmaM));
    const bump = weight * gaussian;
    surface.set(h3, (surface.get(h3) ?? 0) + bump);
  }
}

/**
 * Blends the distance prior with verified-sighting evidence by MASS rather than raw addition:
 * both `priorMap` and the sighting bumps are normalized to sum to 1 before being combined as
 * `(1 - alpha) * prior + alpha * sightingSurface`, where `alpha` is capped (see DEFAULT_ALPHA_MAX)
 * and scaled by the sightings' mean effective (recency-discounted) confidence. This way a
 * high-confidence sighting concentrates probability near it without erasing the prior elsewhere,
 * and a low-confidence one only nudges the surface.
 */
function blendPriorWithSightings(
  priorMap: Map<string, number>,
  verifiedSightings: Sighting[],
  now: number,
  lambda: number,
  sigmaM: number,
  res: number,
  alphaMax: number,
): Map<string, number> {
  const sightingSurface = new Map<string, number>();
  const weights: number[] = [];
  for (const sighting of verifiedSightings) {
    const weight = sightingWeight(sighting, now, lambda);
    if (weight <= 0) continue;
    weights.push(weight);
    addSightingBump(sightingSurface, sighting, weight, sigmaM, res);
  }

  const sightingTotal = Array.from(sightingSurface.values()).reduce((sum, v) => sum + v, 0);
  if (weights.length === 0 || sightingTotal <= 0) return priorMap;

  const meanEffectiveConfidence = weights.reduce((sum, w) => sum + w, 0) / weights.length;
  const alpha = alphaMax * Math.min(1, Math.max(0, meanEffectiveConfidence));

  const keys = new Set([...priorMap.keys(), ...sightingSurface.keys()]);
  const blended = new Map<string, number>();
  for (const h3 of keys) {
    const priorShare = priorMap.get(h3) ?? 0;
    const sightingShare = (sightingSurface.get(h3) ?? 0) / sightingTotal;
    blended.set(h3, (1 - alpha) * priorShare + alpha * sightingShare);
  }
  return blended;
}

/** Computes the normalized (sums to 1) remaining-probability surface over H3 cells. */
export function computeProbabilitySurface(input: ProbabilitySurfaceInput): Map<string, number> {
  const res = input.res ?? CONFIG.H3_RES;
  const lambda = input.lambda ?? decayLambdaPerMs();
  const sigmaM = input.sightingSigmaM ?? DEFAULT_SIGHTING_SIGMA_M;
  const alphaMax = input.alphaMax ?? DEFAULT_ALPHA_MAX;

  const priorMap = computePriorCells(input.ipp, input.category, undefined, res);
  const verifiedSightings = input.verifiedSightings.filter((s) => s.status === 'verified');

  const base =
    verifiedSightings.length > 0
      ? blendPriorWithSightings(priorMap, verifiedSightings, input.now, lambda, sigmaM, res, alphaMax)
      : priorMap;

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
