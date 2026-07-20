/** Barrel export for the signals engine, plus the single entry point the UI/map calls. */
export * from './geo';
export * from './h3';
export * from './coverage';
export * from './prior';
export * from './corroboration';
export * from './probability';
export * from './searchNext';

import { computeCoverageCells, trackToCoverageEvents, watchtowerToCoverageEvents } from './coverage';
import type { CoverageCell } from './coverage';
import { promoteSightings } from './corroboration';
import { computeProbabilitySurface } from './probability';
import { rankSearchNext } from './searchNext';
import type { RankedCell } from './searchNext';
import type { Incident, Sighting, TrackPoint, Watchtower } from '../types';

export interface ComputeSurfacesInput {
  incident: Incident;
  trackPoints: TrackPoint[];
  watchtowers: Watchtower[];
  sightings: Sighting[];
  now: number;
}

export interface ComputeSurfacesResult {
  coverage: Map<string, CoverageCell>;
  probability: Map<string, number>;
  searchNext: RankedCell[];
  promotedSightings: Sighting[];
}

/**
 * The single entry point the UI/map layer calls: promotes corroborated sightings, fuses
 * searcher/watchtower coverage with the statistical prior and verified sightings into a
 * remaining-probability surface, and ranks where to search next.
 */
export function computeSurfaces(input: ComputeSurfacesInput): ComputeSurfacesResult {
  const promotedSightings = promoteSightings(input.sightings);

  const trackEvents = trackToCoverageEvents(input.trackPoints);
  const watchtowerEvents = input.watchtowers.flatMap((w) => watchtowerToCoverageEvents(w, input.now));
  const coverage = computeCoverageCells([...trackEvents, ...watchtowerEvents], input.now);

  const verifiedSightings = promotedSightings.filter((s) => s.status === 'verified');
  const probability = computeProbabilitySurface({
    ipp: input.incident.ipp,
    category: input.incident.subjectCategory,
    verifiedSightings,
    coverage,
    now: input.now,
  });

  const searchNext = rankSearchNext(probability, coverage);

  return { coverage, probability, searchNext, promotedSightings };
}
