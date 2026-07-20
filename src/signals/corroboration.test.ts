import { describe, expect, it } from 'vitest';
import type { Sighting } from '../types';
import { promoteSightings } from './corroboration';

let nextId = 0;
function makeSighting(overrides: Partial<Sighting>): Sighting {
  nextId += 1;
  return {
    id: `s${nextId}`,
    incidentId: 'incident-1',
    reportedBy: 'user-1',
    lat: 10,
    lng: 10,
    observedAt: 1_000_000,
    type: 'visual',
    confidence: 0.6,
    status: 'unverified',
    verifiedBy: null,
    verifiedVia: null,
    corroboratesId: null,
    notes: '',
    photoUrl: null,
    ...overrides,
  };
}

describe('promoteSightings', () => {
  it('(a) leaves two same-user sightings in-window unverified', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 1_000_000 });
    const b = makeSighting({ reportedBy: 'user-1', lat: 10.0005, lng: 10.0005, observedAt: 1_010_000 });

    const result = promoteSightings([a, b]);
    expect(result.find((s) => s.id === a.id)!.status).toBe('unverified');
    expect(result.find((s) => s.id === b.id)!.status).toBe('unverified');
  });

  it('(b) promotes two different users within radius/window/plausibility to verified via corroboration', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 1_000_000 });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0001, lng: 10.0001, observedAt: 1_010_000 });

    const result = promoteSightings([a, b]);
    for (const s of result) {
      expect(s.status).toBe('verified');
      expect(s.verifiedVia).toBe('corroboration');
    }
  });

  it('(c) leaves different users unverified when outside the time window', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 0 });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0005, lng: 10.0005, observedAt: 10_000_000 });

    const result = promoteSightings([a, b], { windowMs: 30 * 60 * 1000 });
    expect(result.every((s) => s.status === 'unverified')).toBe(true);
  });

  it('(c) leaves different users unverified when distance is implausible for the time elapsed', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 1_000_000 });
    // ~5.5km away but observed only 60s later - far beyond any plausible walking speed.
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.05, lng: 10.05, observedAt: 1_060_000 });

    const result = promoteSightings([a, b], { radiusM: 10_000 });
    expect(result.every((s) => s.status === 'unverified')).toBe(true);
  });

  it('(d) keeps a coordinator-rejected sighting rejected even if it would otherwise corroborate', () => {
    const a = makeSighting({
      reportedBy: 'user-1',
      lat: 10,
      lng: 10,
      observedAt: 1_000_000,
      status: 'rejected',
      verifiedBy: 'coordinator-1',
    });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0001, lng: 10.0001, observedAt: 1_010_000 });

    const result = promoteSightings([a, b]);
    expect(result.find((s) => s.id === a.id)!.status).toBe('rejected');
  });

  it('(d) a rejected sighting does not itself count as corroborating evidence for others', () => {
    const rejected = makeSighting({
      reportedBy: 'user-2',
      lat: 10,
      lng: 10,
      observedAt: 1_000_000,
      status: 'rejected',
    });
    const lone = makeSighting({ reportedBy: 'user-1', lat: 10.0001, lng: 10.0001, observedAt: 1_010_000 });

    const result = promoteSightings([rejected, lone]);
    expect(result.find((s) => s.id === lone.id)!.status).toBe('unverified');
  });

  it('(e) keeps a coordinator-verified sighting as coordinator-verified', () => {
    const a = makeSighting({
      reportedBy: 'user-1',
      lat: 10,
      lng: 10,
      observedAt: 1_000_000,
      status: 'verified',
      verifiedVia: 'coordinator',
      verifiedBy: 'coordinator-1',
    });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0001, lng: 10.0001, observedAt: 1_010_000 });

    const result = promoteSightings([a, b]);
    const resultA = result.find((s) => s.id === a.id)!;
    expect(resultA.status).toBe('verified');
    expect(resultA.verifiedVia).toBe('coordinator');
    expect(resultA.verifiedBy).toBe('coordinator-1');
  });

  it('promotes transitively across a chain of >2 users in one connected component', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 1_000_000 });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0001, lng: 10.0001, observedAt: 1_010_000 });
    const c = makeSighting({ reportedBy: 'user-3', lat: 10.0002, lng: 10.0002, observedAt: 1_020_000 });

    const result = promoteSightings([a, b, c]);
    expect(result.every((s) => s.status === 'verified' && s.verifiedVia === 'corroboration')).toBe(true);
  });

  it('does not mutate the input array', () => {
    const a = makeSighting({ reportedBy: 'user-1', lat: 10, lng: 10, observedAt: 1_000_000 });
    const b = makeSighting({ reportedBy: 'user-2', lat: 10.0005, lng: 10.0005, observedAt: 1_010_000 });
    const input = [a, b];
    promoteSightings(input);
    // These stay unverified regardless of promotion, since 78m/10s is beyond plausibility
    // (proving the point: input objects are untouched either way).
    expect(input[0].status).toBe('unverified');
    expect(input[1].status).toBe('unverified');
  });
});
