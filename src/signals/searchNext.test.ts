import { describe, expect, it } from 'vitest';
import type { CoverageCell } from './coverage';
import { rankSearchNext } from './searchNext';

function coverageMap(entries: Array<[string, number]>): Map<string, CoverageCell> {
  return new Map(entries.map(([h3, pod]) => [h3, { h3, pod, lastCoveredAt: 0 }]));
}

describe('rankSearchNext', () => {
  it('excludes well-covered cells (pod >= maxRecentPod)', () => {
    const remaining = new Map([
      ['a', 0.5],
      ['b', 0.4],
      ['c', 0.3],
    ]);
    const coverage = coverageMap([['b', 0.9]]);

    const ranked = rankSearchNext(remaining, coverage, { maxRecentPod: 0.7 });
    expect(ranked.some((r) => r.h3 === 'b')).toBe(false);
    expect(ranked.map((r) => r.h3)).toEqual(['a', 'c']);
  });

  it('returns highest-remaining-probability cells first', () => {
    const remaining = new Map([
      ['a', 0.1],
      ['b', 0.9],
      ['c', 0.5],
    ]);
    const ranked = rankSearchNext(remaining, new Map());
    expect(ranked.map((r) => r.h3)).toEqual(['b', 'c', 'a']);
    expect(ranked[0].score).toBe(0.9);
  });

  it('respects topN', () => {
    const remaining = new Map(Array.from({ length: 30 }, (_, i) => [`cell-${i}`, i / 30]));
    const ranked = rankSearchNext(remaining, new Map(), { topN: 5 });
    expect(ranked).toHaveLength(5);
    expect(ranked[0].h3).toBe('cell-29');
  });

  it('includes cells with no coverage entry (treated as pod 0)', () => {
    const remaining = new Map([['a', 0.5]]);
    const ranked = rankSearchNext(remaining, new Map());
    expect(ranked).toHaveLength(1);
  });

  it('includes a cell right at the boundary only when strictly below maxRecentPod', () => {
    const remaining = new Map([['a', 0.5]]);
    const coverage = coverageMap([['a', 0.7]]);
    const ranked = rankSearchNext(remaining, coverage, { maxRecentPod: 0.7 });
    expect(ranked).toHaveLength(0);
  });
});
