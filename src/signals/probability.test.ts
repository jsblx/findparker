import { describe, expect, it } from 'vitest';
import type { CoverageCell } from './coverage';
import { cellCenter, pointToCell } from './h3';
import { computePriorCells } from './prior';
import { computeProbabilitySurface } from './probability';
import type { Sighting } from '../types';

const IPP = { lat: 37.8651, lng: -119.5383 };
const NOW = 1_000_000;

function makeSighting(overrides: Partial<Sighting>): Sighting {
  return {
    id: 's1',
    incidentId: 'incident-1',
    reportedBy: 'user-1',
    lat: IPP.lat,
    lng: IPP.lng,
    observedAt: NOW,
    type: 'visual',
    confidence: 0.9,
    status: 'verified',
    verifiedBy: null,
    verifiedVia: 'corroboration',
    corroboratesId: null,
    notes: '',
    photoUrl: null,
    ...overrides,
  };
}

describe('computeProbabilitySurface', () => {
  it('approximately equals the prior when there is no coverage and no sightings', () => {
    const prior = computePriorCells(IPP, 'hiker');
    const surface = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage: new Map(),
      now: NOW,
    });

    const total = Array.from(surface.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);

    // Same cell set, same relative ordering as the raw prior (unnormalized coincidentally already
    // sums to 1, so values should match closely).
    expect(surface.size).toBe(prior.size);
    for (const [h3, value] of surface) {
      expect(value).toBeCloseTo(prior.get(h3) ?? 0, 6);
    }
  });

  it('reduces remaining probability in a cell that has been heavily covered', () => {
    const baseline = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage: new Map(),
      now: NOW,
    });

    const [topCell] = Array.from(baseline.entries()).sort((a, b) => b[1] - a[1])[0];
    const coverage = new Map<string, CoverageCell>([[topCell, { h3: topCell, pod: 0.95, lastCoveredAt: NOW }]]);

    const covered = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage,
      now: NOW,
    });

    expect(covered.get(topCell)!).toBeLessThan(baseline.get(topCell)!);
  });

  it('raises probability near a verified sighting location', () => {
    const farPoint = { lat: IPP.lat + 0.03, lng: IPP.lng + 0.03 };

    const baseline = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage: new Map(),
      now: NOW,
    });

    const sighting = makeSighting({ lat: farPoint.lat, lng: farPoint.lng, observedAt: NOW });
    const withSighting = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [sighting],
      coverage: new Map(),
      now: NOW,
    });

    // Find the cell nearest the sighting location in the post-sighting surface.
    const nearestToSighting = Array.from(withSighting.keys())
      .map((h3) => ({ h3, distanceM: Math.hypot(cellCenter(h3).lat - farPoint.lat, cellCenter(h3).lng - farPoint.lng) }))
      .sort((a, b) => a.distanceM - b.distanceM)[0].h3;

    const before = baseline.get(nearestToSighting) ?? 0;
    const after = withSighting.get(nearestToSighting) ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('ignores unverified sightings entirely', () => {
    const unverified = makeSighting({ status: 'unverified', verifiedVia: null });
    const withUnverified = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [unverified],
      coverage: new Map(),
      now: NOW,
    });
    const baseline = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage: new Map(),
      now: NOW,
    });

    expect(withUnverified.size).toBe(baseline.size);
    for (const [h3, value] of withUnverified) {
      expect(value).toBeCloseTo(baseline.get(h3) ?? 0, 6);
    }
  });

  it('does not annihilate the prior away from a high-confidence verified sighting', () => {
    const farPoint = { lat: IPP.lat + 0.03, lng: IPP.lng + 0.03 };

    const baseline = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [],
      coverage: new Map(),
      now: NOW,
    });

    // The prior's peak cell (highest baseline probability), far from the sighting location.
    const [peakCell, peakValue] = Array.from(baseline.entries()).sort((a, b) => b[1] - a[1])[0];

    const sighting = makeSighting({ lat: farPoint.lat, lng: farPoint.lng, observedAt: NOW, confidence: 0.95 });
    const withSighting = computeProbabilitySurface({
      ipp: IPP,
      category: 'hiker',
      verifiedSightings: [sighting],
      coverage: new Map(),
      now: NOW,
    });

    const peakAfter = withSighting.get(peakCell) ?? 0;
    // A single sighting bump must not collapse the entire surface onto itself: the prior's
    // peak should retain a meaningful share of the mass, not be reduced to ~0.
    expect(peakAfter).toBeGreaterThan(peakValue * 0.05);
  });

  it('always sums to approximately 1', () => {
    const sighting = makeSighting({});
    const ippCell = pointToCell(IPP);
    const surface = computeProbabilitySurface({
      ipp: IPP,
      category: 'dementia',
      verifiedSightings: [sighting],
      coverage: new Map([[ippCell, { h3: ippCell, pod: 0.5, lastCoveredAt: NOW }]]),
      now: NOW,
    });
    const total = Array.from(surface.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
