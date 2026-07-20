import { describe, expect, it } from 'vitest';
import { haversineM } from '../signals';
import { distanceRings, ringPolygon } from './geometry';
import type { LatLng } from '../types';

const CENTER: LatLng = { lat: 45, lng: -122 };

describe('ringPolygon', () => {
  it('returns the requested number of vertices', () => {
    expect(ringPolygon(CENTER, 1000, 32)).toHaveLength(32);
  });

  it('defaults to 64 segments', () => {
    expect(ringPolygon(CENTER, 1000)).toHaveLength(64);
  });

  it('places every vertex approximately radiusM from the center', () => {
    const radiusM = 2500;
    const polygon = ringPolygon(CENTER, radiusM, 48);
    for (const vertex of polygon) {
      expect(haversineM(CENTER, vertex)).toBeCloseTo(radiusM, -1);
    }
  });
});

describe('distanceRings', () => {
  it('returns 4 rings with strictly increasing radii matching the category quantiles', () => {
    const rings = distanceRings(CENTER, 'hiker');
    expect(rings).toHaveLength(4);
    expect(rings.map((r) => r.label)).toEqual(['p25', 'p50', 'p75', 'p95']);

    for (let i = 1; i < rings.length; i += 1) {
      expect(rings[i].radiusM).toBeGreaterThan(rings[i - 1].radiusM);
    }
  });

  it('builds each ring polygon around the IPP at the stated radius', () => {
    const rings = distanceRings(CENTER, 'dementia');
    for (const ring of rings) {
      expect(ring.polygon.length).toBeGreaterThan(0);
      for (const vertex of ring.polygon) {
        expect(haversineM(CENTER, vertex)).toBeCloseTo(ring.radiusM, -1);
      }
    }
  });
});
