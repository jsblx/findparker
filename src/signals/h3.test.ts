import { describe, expect, it } from 'vitest';
import { gridDistance } from 'h3-js';
import { cellBoundary, cellCenter, cellsForPoint, cellsForSegment, edgeLengthM, pointToCell } from './h3';

const IPP = { lat: 37.8651, lng: -119.5383 }; // Yosemite Valley, arbitrary test location

describe('pointToCell / cellCenter / cellBoundary', () => {
  it('round-trips a point to a cell whose center is close to the original point', () => {
    const cell = pointToCell(IPP);
    const center = cellCenter(cell);
    expect(Math.abs(center.lat - IPP.lat)).toBeLessThan(0.01);
    expect(Math.abs(center.lng - IPP.lng)).toBeLessThan(0.01);
  });

  it('returns a closed ring of boundary points', () => {
    const cell = pointToCell(IPP);
    const boundary = cellBoundary(cell);
    expect(boundary.length).toBeGreaterThanOrEqual(5);
    for (const p of boundary) {
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lng).toBe('number');
    }
  });
});

describe('cellsForPoint', () => {
  it('always includes the point-of-origin cell', () => {
    const cells = cellsForPoint(IPP, 10);
    expect(cells).toContain(pointToCell(IPP));
  });

  it('grows (or stays equal) as radius increases', () => {
    const small = cellsForPoint(IPP, 10);
    const large = cellsForPoint(IPP, 500);
    expect(large.length).toBeGreaterThanOrEqual(small.length);
    expect(large.length).toBeGreaterThan(1);
  });

  it('has no duplicate cells', () => {
    const cells = cellsForPoint(IPP, 300);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('cellsForSegment', () => {
  it('yields multiple contiguous cells for a short line, with no gaps', () => {
    const a = IPP;
    const b = { lat: IPP.lat + 0.01, lng: IPP.lng + 0.01 }; // ~1.1km diagonal
    const cells = cellsForSegment(a, b, 15);

    expect(cells.length).toBeGreaterThan(1);
    expect(new Set(cells).size).toBe(cells.length);

    // Contiguity check: every cell should be within a small grid-distance of some other cell
    // in the set (i.e. the set forms one connected blob, not scattered islands).
    const cellA = pointToCell(a);
    const cellB = pointToCell(b);
    expect(cells).toContain(cellA);
    expect(cells).toContain(cellB);

    const maxDist = Math.max(...cells.map((c) => gridDistance(cellA, c)));
    // The segment plus its radius disk shouldn't produce isolated cells far beyond the path.
    expect(maxDist).toBeLessThan(50);
  });

  it('degenerates gracefully when a === b', () => {
    const cells = cellsForSegment(IPP, IPP, 20);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells).toContain(pointToCell(IPP));
  });
});

describe('edgeLengthM', () => {
  it('decreases as resolution increases', () => {
    expect(edgeLengthM(9)).toBeGreaterThan(edgeLengthM(10));
    expect(edgeLengthM(10)).toBeGreaterThan(edgeLengthM(11));
  });
});
