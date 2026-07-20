/** Turns raw searcher tracks and watchtower sessions into decayed per-cell probability-of-detection coverage. */
import { CONFIG, decayLambdaPerMs } from '../config';
import type { TrackPoint, Watchtower } from '../types';
import { cellsForPoint, cellsForSegment } from './h3';

export interface CoverageEvent {
  h3: string;
  t: number;
  pod: number;
}

export interface CoverageCell {
  h3: string;
  pod: number;
  lastCoveredAt: number;
}

const DEFAULT_BASE_POD = 0.5;
const DEFAULT_WATCHTOWER_POD = 0.85;

function groupBySessionId(points: TrackPoint[]): Map<string, TrackPoint[]> {
  const groups = new Map<string, TrackPoint[]>();
  for (const point of points) {
    const group = groups.get(point.sessionId);
    if (group) {
      group.push(point);
    } else {
      groups.set(point.sessionId, [point]);
    }
  }
  return groups;
}

/** Converts searcher GPS breadcrumbs into per-cell coverage events, one session at a time. */
export function trackToCoverageEvents(
  points: TrackPoint[],
  opts?: { radiusM?: number; basePod?: number; res?: number },
): CoverageEvent[] {
  const radiusM = opts?.radiusM ?? CONFIG.DETECTION_RADIUS_M;
  const basePod = opts?.basePod ?? DEFAULT_BASE_POD;
  const res = opts?.res ?? CONFIG.H3_RES;

  const events: CoverageEvent[] = [];
  for (const group of groupBySessionId(points).values()) {
    const sorted = [...group].sort((a, b) => a.recordedAt - b.recordedAt);

    if (sorted.length === 1) {
      const point = sorted[0];
      for (const h3 of cellsForPoint(point, radiusM, res)) {
        events.push({ h3, t: point.recordedAt, pod: basePod });
      }
      continue;
    }

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const from = sorted[i];
      const to = sorted[i + 1];
      for (const h3 of cellsForSegment(from, to, radiusM, res)) {
        events.push({ h3, t: to.recordedAt, pod: basePod });
      }
    }
  }
  return events;
}

/** Converts a stationary watchtower's observation radius into per-cell coverage events. */
export function watchtowerToCoverageEvents(
  w: Watchtower,
  now: number,
  opts?: { pod?: number; res?: number },
): CoverageEvent[] {
  const pod = opts?.pod ?? DEFAULT_WATCHTOWER_POD;
  const res = opts?.res ?? CONFIG.H3_RES;
  const t = w.activeTo ?? now;

  return cellsForPoint({ lat: w.lat, lng: w.lng }, w.radiusM, res).map((h3) => ({ h3, t, pod }));
}

/**
 * Fuses coverage events into a decayed probability-of-detection per cell:
 * `pod = 1 - Π(1 - pod_i * exp(-lambda * max(0, now - t_i)))`, i.e. the probability that at
 * least one of the (independent) coverage passes would have detected the subject, each pass's
 * confidence decaying with time since it happened. Capped below 1 since detection is never
 * certain.
 */
export function computeCoverageCells(
  events: CoverageEvent[],
  now: number,
  lambda: number = decayLambdaPerMs(),
): Map<string, CoverageCell> {
  const misDetectProduct = new Map<string, number>();
  const lastCoveredAt = new Map<string, number>();

  for (const event of events) {
    const decayedPod = event.pod * Math.exp(-lambda * Math.max(0, now - event.t));
    const prevMiss = misDetectProduct.get(event.h3) ?? 1;
    misDetectProduct.set(event.h3, prevMiss * (1 - decayedPod));

    const prevLast = lastCoveredAt.get(event.h3);
    if (prevLast === undefined || event.t > prevLast) {
      lastCoveredAt.set(event.h3, event.t);
    }
  }

  const cells = new Map<string, CoverageCell>();
  for (const [h3, missProduct] of misDetectProduct) {
    const pod = Math.min(0.99, Math.max(0, 1 - missProduct));
    cells.set(h3, { h3, pod, lastCoveredAt: lastCoveredAt.get(h3) ?? now });
  }
  return cells;
}
