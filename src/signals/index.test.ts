import { describe, expect, it } from 'vitest';
import type { Incident, Sighting, TrackPoint, Watchtower } from '../types';
import { computeSurfaces } from './index';

const IPP = { lat: 37.8651, lng: -119.5383 };
const NOW = 1_000_000;

const incident: Incident = {
  id: 'incident-1',
  name: 'Test incident',
  subjectCategory: 'hiker',
  ipp: IPP,
  startedAt: NOW - 3_600_000,
  status: 'active',
};

describe('computeSurfaces', () => {
  it('wires coverage, probability, searchNext, and sighting promotion together end-to-end', () => {
    const trackPoints: TrackPoint[] = [
      { id: 't1', sessionId: 'session-1', lat: IPP.lat, lng: IPP.lng, accuracyM: 5, recordedAt: NOW - 60_000 },
      {
        id: 't2',
        sessionId: 'session-1',
        lat: IPP.lat + 0.001,
        lng: IPP.lng + 0.001,
        accuracyM: 5,
        recordedAt: NOW - 30_000,
      },
    ];
    const watchtowers: Watchtower[] = [
      {
        id: 'w1',
        incidentId: incident.id,
        sessionId: null,
        lat: IPP.lat + 0.01,
        lng: IPP.lng + 0.01,
        radiusM: 200,
        activeFrom: NOW - 3_600_000,
        activeTo: NOW - 100_000,
      },
    ];
    const sightings: Sighting[] = [
      {
        id: 'sight-1',
        incidentId: incident.id,
        reportedBy: 'user-1',
        lat: IPP.lat + 0.02,
        lng: IPP.lng + 0.02,
        observedAt: NOW - 10_000,
        type: 'visual',
        confidence: 0.8,
        status: 'unverified',
        verifiedBy: null,
        verifiedVia: null,
        corroboratesId: null,
        notes: '',
        photoUrl: null,
      },
      {
        id: 'sight-2',
        incidentId: incident.id,
        reportedBy: 'user-2',
        lat: IPP.lat + 0.0201,
        lng: IPP.lng + 0.0201,
        observedAt: NOW - 5_000,
        type: 'visual',
        confidence: 0.7,
        status: 'unverified',
        verifiedBy: null,
        verifiedVia: null,
        corroboratesId: null,
        notes: '',
        photoUrl: null,
      },
    ];

    const result = computeSurfaces({ incident, trackPoints, watchtowers, sightings, now: NOW });

    expect(result.coverage.size).toBeGreaterThan(0);
    expect(result.probability.size).toBeGreaterThan(0);
    expect(result.searchNext.length).toBeGreaterThan(0);

    const total = Array.from(result.probability.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);

    // The two close-together, different-user, in-window sightings should have corroborated.
    expect(result.promotedSightings.every((s) => s.status === 'verified' && s.verifiedVia === 'corroboration')).toBe(
      true,
    );

    // searchNext should be sorted descending by score.
    for (let i = 1; i < result.searchNext.length; i += 1) {
      expect(result.searchNext[i].score).toBeLessThanOrEqual(result.searchNext[i - 1].score);
    }
  });

  it('handles an incident with no tracks, towers, or sightings', () => {
    const result = computeSurfaces({ incident, trackPoints: [], watchtowers: [], sightings: [], now: NOW });
    expect(result.coverage.size).toBe(0);
    expect(result.promotedSightings).toEqual([]);
    const total = Array.from(result.probability.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
