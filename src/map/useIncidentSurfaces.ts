/** Loads an incident's live data and derives its coverage/probability surfaces, shared by the map and coordinator views. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../data';
import { computeSurfaces } from '../signals';
import type { CoverageCell } from '../signals';
import type { RankedCell } from '../signals';
import type { Incident, Sighting, TrackPoint, Watchtower } from '../types';

const REFRESH_DEBOUNCE_MS = 300;

export interface UseIncidentSurfacesResult {
  incident: Incident | null;
  trackPoints: TrackPoint[];
  watchtowers: Watchtower[];
  sightings: Sighting[];
  coverage: Map<string, CoverageCell>;
  probability: Map<string, number>;
  searchNext: RankedCell[];
  promotedSightings: Sighting[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const EMPTY_COVERAGE = new Map<string, CoverageCell>();
const EMPTY_PROBABILITY = new Map<string, number>();

/**
 * Fetches an incident plus its track points/watchtowers/sightings, recomputes the coverage
 * and remaining-probability surfaces via `computeSurfaces`, and keeps them live by refetching
 * whenever the provider reports a change (debounced to absorb realtime bursts).
 */
export function useIncidentSurfaces(incidentId: string): UseIncidentSurfacesResult {
  const provider = useData();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [watchtowers, setWatchtowers] = useState<Watchtower[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const fetchedIncident = await provider.getIncident(incidentId);
      if (!fetchedIncident) {
        setIncident(null);
        setTrackPoints([]);
        setWatchtowers([]);
        setSightings([]);
        setError(null);
        setLoading(false);
        return;
      }

      const [fetchedTrackPoints, fetchedWatchtowers, fetchedSightings] = await Promise.all([
        provider.listTrackPoints(incidentId),
        provider.listWatchtowers(incidentId),
        provider.listSightings(incidentId),
      ]);

      setIncident(fetchedIncident);
      setTrackPoints(fetchedTrackPoints);
      setWatchtowers(fetchedWatchtowers);
      setSightings(fetchedSightings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [provider, incidentId]);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setLoading(true);
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    const onChange = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
    };
    const unsubscribe = provider.subscribe(incidentId, onChange);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [provider, incidentId, refresh]);

  const surfaces = useMemo(() => {
    if (!incident) {
      return {
        coverage: EMPTY_COVERAGE,
        probability: EMPTY_PROBABILITY,
        searchNext: [] as RankedCell[],
        promotedSightings: [] as Sighting[],
      };
    }
    return computeSurfaces({ incident, trackPoints, watchtowers, sightings, now });
  }, [incident, trackPoints, watchtowers, sightings, now]);

  return {
    incident,
    trackPoints,
    watchtowers,
    sightings,
    coverage: surfaces.coverage,
    probability: surfaces.probability,
    searchNext: surfaces.searchNext,
    promotedSightings: surfaces.promotedSightings,
    loading,
    error,
    refresh,
  };
}
