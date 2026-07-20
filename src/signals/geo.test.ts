import { describe, expect, it } from 'vitest';
import { haversineM } from './geo';

describe('haversineM', () => {
  it('returns 0 for identical points', () => {
    expect(haversineM({ lat: 40, lng: -73 }, { lat: 40, lng: -73 })).toBe(0);
  });

  it('matches known distance between NYC and LA (~3936km) within 1%', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const d = haversineM(nyc, la);
    expect(d).toBeGreaterThan(3_900_000);
    expect(d).toBeLessThan(3_970_000);
  });

  it('matches known distance for one degree of latitude (~111.19km)', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    const d = haversineM(a, b);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});
