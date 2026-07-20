import { describe, expect, it } from 'vitest';
import type { SubjectCategory } from '../types';
import { haversineM } from './geo';
import { cellCenter } from './h3';
import { candidateCellsAroundIPP, computePriorCells, DISTANCE_QUANTILES, priorDensityAtDistance, radialCdf } from './prior';

const IPP = { lat: 37.8651, lng: -119.5383 };
const CATEGORIES = Object.keys(DISTANCE_QUANTILES) as SubjectCategory[];

describe('DISTANCE_QUANTILES', () => {
  it('is strictly ordered p25 < p50 < p75 < p95 for every category', () => {
    for (const category of CATEGORIES) {
      const q = DISTANCE_QUANTILES[category];
      expect(q.p25).toBeLessThan(q.p50);
      expect(q.p50).toBeLessThan(q.p75);
      expect(q.p75).toBeLessThan(q.p95);
    }
  });
});

describe('radialCdf', () => {
  it('is 0 at distance 0 and 1 at 1.5x p95', () => {
    for (const category of CATEGORIES) {
      const q = DISTANCE_QUANTILES[category];
      expect(radialCdf(category, 0)).toBe(0);
      expect(radialCdf(category, 1.5 * q.p95)).toBeCloseTo(1, 6);
      expect(radialCdf(category, 2 * q.p95)).toBe(1);
    }
  });

  it('hits the quantile points exactly', () => {
    const q = DISTANCE_QUANTILES.hiker;
    expect(radialCdf('hiker', q.p25)).toBeCloseTo(0.25, 6);
    expect(radialCdf('hiker', q.p50)).toBeCloseTo(0.5, 6);
    expect(radialCdf('hiker', q.p75)).toBeCloseTo(0.75, 6);
    expect(radialCdf('hiker', q.p95)).toBeCloseTo(0.95, 6);
  });

  it('is monotonically non-decreasing', () => {
    const q = DISTANCE_QUANTILES.dementia;
    const samples = Array.from({ length: 50 }, (_, i) => (i / 49) * 1.5 * q.p95);
    let prev = -1;
    for (const d of samples) {
      const cdf = radialCdf('dementia', d);
      expect(cdf).toBeGreaterThanOrEqual(prev);
      prev = cdf;
    }
  });
});

describe('priorDensityAtDistance', () => {
  it('decreases (non-increasing) as distance grows beyond the near-IPP floor', () => {
    const q = DISTANCE_QUANTILES.hiker;
    const samples = [50, q.p25, q.p50, q.p75, q.p95, 1.4 * q.p95];
    let prev = Infinity;
    for (const d of samples) {
      const density = priorDensityAtDistance('hiker', d);
      expect(density).toBeLessThanOrEqual(prev);
      prev = density;
    }
  });

  it('never returns a negative or non-finite value near d=0', () => {
    const density = priorDensityAtDistance('child_1_6', 0);
    expect(Number.isFinite(density)).toBe(true);
    expect(density).toBeGreaterThan(0);
  });
});

describe('candidateCellsAroundIPP', () => {
  it('returns a non-empty set of cells covering the practical search radius', () => {
    const cells = candidateCellsAroundIPP(IPP, 'hiker');
    expect(cells.length).toBeGreaterThan(1);
  });
});

describe('computePriorCells', () => {
  it('sums to approximately 1 across all candidate cells', () => {
    const map = computePriorCells(IPP, 'dementia');
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('assigns higher probability to cells nearer the IPP than to cells far from it', () => {
    const map = computePriorCells(IPP, 'hiker');
    const byDistance = Array.from(map.keys())
      .map((h3) => ({ h3, distanceM: haversineM(cellCenter(h3), IPP) }))
      .sort((a, b) => a.distanceM - b.distanceM);

    const nearest = byDistance[0];
    const farthest = byDistance[byDistance.length - 1];
    expect(map.get(nearest.h3)!).toBeGreaterThan(map.get(farthest.h3)!);
  });
});
