import { describe, expect, it } from 'vitest';
import { coverageColor, ippColor, probabilityColor, ringColor, searchNextColor, sightingColor } from './colors';

describe('coverageColor', () => {
  it('is fully transparent at pod=0', () => {
    expect(coverageColor(0)[3]).toBe(0);
  });

  it('alpha increases monotonically with pod', () => {
    const alphas = [0, 0.25, 0.5, 0.75, 1].map((pod) => coverageColor(pod)[3]);
    for (let i = 1; i < alphas.length; i += 1) {
      expect(alphas[i]).toBeGreaterThan(alphas[i - 1]);
    }
  });

  it('clamps out-of-range pod values', () => {
    expect(coverageColor(-1)[3]).toBe(0);
    expect(coverageColor(2)[3]).toBe(coverageColor(1)[3]);
  });

  it('keeps RGB constant across pod values (only alpha varies)', () => {
    const [r1, g1, b1] = coverageColor(0.1);
    const [r2, g2, b2] = coverageColor(0.9);
    expect([r1, g1, b1]).toEqual([r2, g2, b2]);
  });
});

describe('probabilityColor', () => {
  it('is faint (low alpha) when probability is low relative to max', () => {
    const [, , , alpha] = probabilityColor(0.01, 1);
    expect(alpha).toBeLessThan(30);
  });

  it('is near-opaque when probability equals the surface max', () => {
    const [, , , alpha] = probabilityColor(1, 1);
    expect(alpha).toBeGreaterThan(200);
  });

  it('normalizes by max rather than using an absolute scale', () => {
    const lowMaxColor = probabilityColor(0.5, 0.5);
    const highMaxColor = probabilityColor(0.5, 5);
    expect(lowMaxColor[3]).toBeGreaterThan(highMaxColor[3]);
  });

  it('does not throw or return NaN when max is 0', () => {
    const color = probabilityColor(0, 0);
    expect(color.every((c) => Number.isFinite(c))).toBe(true);
  });

  it('shifts hue from yellow toward red as the ratio increases (green channel fades out)', () => {
    const low = probabilityColor(0.1, 1);
    const high = probabilityColor(1, 1);
    expect(high[1]).toBeLessThan(low[1]);
  });
});

describe('sightingColor', () => {
  it('gives verified, unverified, and rejected distinct colors', () => {
    const verified = sightingColor('verified');
    const unverified = sightingColor('unverified');
    const rejected = sightingColor('rejected');

    expect(verified).not.toEqual(unverified);
    expect(verified).not.toEqual(rejected);
    expect(unverified).not.toEqual(rejected);
  });

  it('renders verified as more opaque (solid) than unverified (faded) or rejected (greyed)', () => {
    expect(sightingColor('verified')[3]).toBeGreaterThan(sightingColor('unverified')[3]);
    expect(sightingColor('verified')[3]).toBeGreaterThan(sightingColor('rejected')[3]);
  });
});

describe('marker colors', () => {
  it('gives the IPP, distance rings, and search-next cells distinct, stable colors', () => {
    expect(ippColor()).not.toEqual(ringColor());
    expect(ippColor()).not.toEqual(searchNextColor());
    expect(ringColor()).not.toEqual(searchNextColor());
    expect(ippColor()).toEqual(ippColor());
  });
});
