import { describe, expect, it } from 'vitest';
import { CONFIG, decayLambdaPerMs } from '../config';
import type { TrackPoint, Watchtower } from '../types';
import { computeCoverageCells, trackToCoverageEvents, watchtowerToCoverageEvents } from './coverage';
import { pointToCell } from './h3';

const HALF_LIFE = CONFIG.DECAY_HALF_LIFE_MS;

describe('computeCoverageCells', () => {
  it('decays a single event pod by half after one half-life', () => {
    const now = 1_000_000;
    const events = [{ h3: 'abc', t: now, pod: 0.5 }];

    const atT = computeCoverageCells(events, now);
    const atHalfLifeLater = computeCoverageCells(events, now + HALF_LIFE);

    expect(atT.get('abc')!.pod).toBeCloseTo(0.5, 6);
    expect(atHalfLifeLater.get('abc')!.pod).toBeCloseTo(0.25, 6);
  });

  it('increases pod when two overlapping passes cover the same cell', () => {
    const now = 1_000_000;
    const singlePass = computeCoverageCells([{ h3: 'abc', t: now, pod: 0.5 }], now);
    const doublePass = computeCoverageCells(
      [
        { h3: 'abc', t: now, pod: 0.5 },
        { h3: 'abc', t: now, pod: 0.5 },
      ],
      now,
    );

    expect(doublePass.get('abc')!.pod).toBeGreaterThan(singlePass.get('abc')!.pod);
    // 1 - (1-0.5)*(1-0.5) = 0.75
    expect(doublePass.get('abc')!.pod).toBeCloseTo(0.75, 6);
  });

  it('never exceeds the 0.99 cap even with many confident passes', () => {
    const now = 1_000_000;
    const events = Array.from({ length: 20 }, () => ({ h3: 'abc', t: now, pod: 0.9 }));
    const cells = computeCoverageCells(events, now);
    expect(cells.get('abc')!.pod).toBeLessThanOrEqual(0.99);
  });

  it('records lastCoveredAt as the max event time for the cell', () => {
    const events = [
      { h3: 'abc', t: 1000, pod: 0.5 },
      { h3: 'abc', t: 5000, pod: 0.3 },
      { h3: 'abc', t: 3000, pod: 0.4 },
    ];
    const cells = computeCoverageCells(events, 10_000);
    expect(cells.get('abc')!.lastCoveredAt).toBe(5000);
  });

  it('uses the provided lambda rather than always the config default', () => {
    const now = 1_000_000;
    const events = [{ h3: 'abc', t: now - 1000, pod: 0.5 }];
    const withZeroDecay = computeCoverageCells(events, now, 0);
    expect(withZeroDecay.get('abc')!.pod).toBeCloseTo(0.5, 6);
    expect(decayLambdaPerMs()).toBeGreaterThan(0);
  });
});

describe('trackToCoverageEvents', () => {
  const baseSession = 'session-1';

  it('emits events for a single-point session using cellsForPoint', () => {
    const points: TrackPoint[] = [
      { id: '1', sessionId: baseSession, lat: 10, lng: 10, accuracyM: 5, recordedAt: 1000 },
    ];
    const events = trackToCoverageEvents(points);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.t === 1000)).toBe(true);
    expect(events[0].h3).toBe(pointToCell({ lat: 10, lng: 10 }));
  });

  it('emits events keyed by the later point recordedAt for a multi-point session', () => {
    const points: TrackPoint[] = [
      { id: '1', sessionId: baseSession, lat: 10, lng: 10, accuracyM: 5, recordedAt: 1000 },
      { id: '2', sessionId: baseSession, lat: 10.001, lng: 10.001, accuracyM: 5, recordedAt: 2000 },
    ];
    const events = trackToCoverageEvents(points);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.t === 2000)).toBe(true);
  });

  it('groups by sessionId independently, sorting each by recordedAt regardless of input order', () => {
    const points: TrackPoint[] = [
      { id: '2', sessionId: 'a', lat: 10.001, lng: 10.001, accuracyM: 5, recordedAt: 2000 },
      { id: '1', sessionId: 'a', lat: 10, lng: 10, accuracyM: 5, recordedAt: 1000 },
      { id: '3', sessionId: 'b', lat: 20, lng: 20, accuracyM: 5, recordedAt: 500 },
    ];
    const events = trackToCoverageEvents(points);
    const sessionBEvents = events.filter((e) => e.h3 === pointToCell({ lat: 20, lng: 20 }));
    expect(sessionBEvents.every((e) => e.t === 500)).toBe(true);
  });
});

describe('watchtowerToCoverageEvents', () => {
  it('emits high-pod events for cells within the tower radius, using activeTo when present', () => {
    const now = 5000;
    const tower: Watchtower = {
      id: 'w1',
      incidentId: 'i1',
      sessionId: null,
      lat: 10,
      lng: 10,
      radiusM: 200,
      activeFrom: 0,
      activeTo: 3000,
    };
    const events = watchtowerToCoverageEvents(tower, now);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.t === 3000)).toBe(true);
    expect(events.every((e) => e.pod >= 0.8)).toBe(true);
  });

  it('falls back to now when activeTo is null', () => {
    const now = 5000;
    const tower: Watchtower = {
      id: 'w1',
      incidentId: 'i1',
      sessionId: null,
      lat: 10,
      lng: 10,
      radiusM: 200,
      activeFrom: 0,
      activeTo: null,
    };
    const events = watchtowerToCoverageEvents(tower, now);
    expect(events.every((e) => e.t === now)).toBe(true);
  });
});
