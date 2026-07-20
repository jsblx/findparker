/** Turns the remaining-probability surface into a ranked list of cells searchers should cover next. */
import type { CoverageCell } from './coverage';

const DEFAULT_TOP_N = 20;
const DEFAULT_MAX_RECENT_POD = 0.7;

export interface RankedCell {
  h3: string;
  score: number;
}

/**
 * Ranks cells by remaining probability, excluding any cell that's already been searched
 * thoroughly and recently (probability of detection at or above `maxRecentPod`).
 */
export function rankSearchNext(
  remaining: Map<string, number>,
  coverage: Map<string, CoverageCell>,
  opts?: { topN?: number; maxRecentPod?: number },
): RankedCell[] {
  const topN = opts?.topN ?? DEFAULT_TOP_N;
  const maxRecentPod = opts?.maxRecentPod ?? DEFAULT_MAX_RECENT_POD;

  return Array.from(remaining.entries())
    .filter(([h3]) => (coverage.get(h3)?.pod ?? 0) < maxRecentPod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([h3, score]) => ({ h3, score }));
}
