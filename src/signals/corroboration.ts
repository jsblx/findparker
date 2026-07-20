/**
 * Collective-verification rule: independent, mutually-consistent sighting reports from
 * different searchers promote each other to "verified" without waiting on a coordinator.
 */
import { CONFIG } from '../config';
import { haversineM } from './geo';
import type { Sighting } from '../types';

const DEFAULT_SLACK_M = 50;

interface PromoteOpts {
  radiusM?: number;
  windowMs?: number;
  maxSpeedMps?: number;
  slackM?: number;
}

/** Whether two sightings corroborate one another: different reporters, close in space and time, and consistent with the subject's max plausible travel speed. */
function areLinked(a: Sighting, b: Sighting, radiusM: number, windowMs: number, maxSpeedMps: number, slackM: number): boolean {
  if (a.reportedBy === b.reportedBy) return false;

  const distanceM = haversineM({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  if (distanceM > radiusM) return false;

  const dtMs = Math.abs(a.observedAt - b.observedAt);
  if (dtMs > windowMs) return false;

  const plausibleMaxDistanceM = maxSpeedMps * (dtMs / 1000) + slackM;
  return distanceM <= plausibleMaxDistanceM;
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootA] = rootB;
  }
}

/**
 * Returns a new array of sightings with corroborated reports promoted to `verified`.
 *
 * Coordinator decisions always win: a `rejected` sighting is excluded from the corroboration
 * graph entirely (it can neither be promoted nor serve as evidence for another sighting), and a
 * coordinator-`verified` sighting keeps its status but can still corroborate others. Everything
 * else (unverified sightings) is promoted only when it falls in a connected component - built
 * from pairwise space/time/plausibility links - that includes reports from at least 2 distinct
 * users.
 */
export function promoteSightings(sightings: Sighting[], opts?: PromoteOpts): Sighting[] {
  const radiusM = opts?.radiusM ?? CONFIG.CORROBORATION_RADIUS_M;
  const windowMs = opts?.windowMs ?? CONFIG.CORROBORATION_WINDOW_MS;
  const maxSpeedMps = opts?.maxSpeedMps ?? CONFIG.SUBJECT_MAX_SPEED_MPS;
  const slackM = opts?.slackM ?? DEFAULT_SLACK_M;

  const active = sightings
    .map((sighting, origIndex) => ({ sighting, origIndex }))
    .filter((entry) => entry.sighting.status !== 'rejected');

  const uf = new UnionFind(active.length);
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      if (areLinked(active[i].sighting, active[j].sighting, radiusM, windowMs, maxSpeedMps, slackM)) {
        uf.union(i, j);
      }
    }
  }

  const componentUsers = new Map<number, Set<string>>();
  active.forEach(({ sighting }, i) => {
    const root = uf.find(i);
    const users = componentUsers.get(root) ?? new Set<string>();
    users.add(sighting.reportedBy);
    componentUsers.set(root, users);
  });

  const updates = new Map<number, Sighting>();
  active.forEach(({ sighting, origIndex }, i) => {
    if (sighting.status === 'verified' && sighting.verifiedVia === 'coordinator') return;

    const users = componentUsers.get(uf.find(i))!;
    if (users.size >= 2) {
      updates.set(origIndex, { ...sighting, status: 'verified', verifiedVia: 'corroboration' });
    }
  });

  return sightings.map((sighting, idx) => updates.get(idx) ?? sighting);
}
