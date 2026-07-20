import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataProviderContext, InMemoryProvider } from '../data';
import { useIncidentSurfaces } from './useIncidentSurfaces';
import type { PropsWithChildren } from 'react';

function wrapperFor(provider: InMemoryProvider) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <DataProviderContext.Provider value={provider}>{children}</DataProviderContext.Provider>;
  };
}

async function setup() {
  const provider = new InMemoryProvider();
  const coordinator = await provider.signInAnonymously('Coordinator', 'coordinator');
  const incident = await provider.createIncident({
    name: 'Lost hiker',
    subjectCategory: 'hiker',
    ipp: { lat: 45, lng: -122 },
  });

  const searcher = await provider.signInAnonymously('Searcher', 'searcher');
  const session = await provider.startSession(incident.id, 'moving');
  await provider.appendTrackPoints(session.id, [
    { lat: 45.001, lng: -122.001, accuracyM: 5, recordedAt: Date.now() - 60_000 },
    { lat: 45.002, lng: -122.002, accuracyM: 5, recordedAt: Date.now() - 30_000 },
  ]);

  await provider.submitSighting({
    incidentId: incident.id,
    reportedBy: searcher.id,
    lat: 45.003,
    lng: -122.003,
    observedAt: Date.now() - 10_000,
    type: 'visual',
    confidence: 0.8,
    notes: 'Saw someone matching description',
    photoUrl: null,
  });

  return { provider, incident, coordinator, searcher };
}

describe('useIncidentSurfaces', () => {
  it('loads the incident and computes non-empty coverage and probability surfaces', async () => {
    const { provider, incident } = await setup();
    const { result } = renderHook(() => useIncidentSurfaces(incident.id), {
      wrapper: wrapperFor(provider),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.incident?.id).toBe(incident.id);
    expect(result.current.coverage.size).toBeGreaterThan(0);
    expect(result.current.probability.size).toBeGreaterThan(0);
    expect(result.current.trackPoints.length).toBe(2);
    expect(result.current.sightings.length).toBe(1);
  });

  it('handles a nonexistent incident gracefully', async () => {
    const provider = new InMemoryProvider();
    const { result } = renderHook(() => useIncidentSurfaces('does-not-exist'), {
      wrapper: wrapperFor(provider),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.incident).toBeNull();
    expect(result.current.coverage.size).toBe(0);
    expect(result.current.probability.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('refetches and recomputes surfaces when the provider reports a mutation (debounced)', async () => {
    const { provider, incident, searcher } = await setup();
    const { result } = renderHook(() => useIncidentSurfaces(incident.id), {
      wrapper: wrapperFor(provider),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const sightingsBefore = result.current.sightings.length;

    await act(async () => {
      await provider.submitSighting({
        incidentId: incident.id,
        reportedBy: searcher.id,
        lat: 45.004,
        lng: -122.004,
        observedAt: Date.now(),
        type: 'clothing',
        confidence: 0.6,
        notes: 'Found a jacket',
        photoUrl: null,
      });
    });

    await waitFor(() => expect(result.current.sightings.length).toBe(sightingsBefore + 1), {
      timeout: 2000,
    });
  });

  it('unsubscribes from the provider on unmount', async () => {
    const { provider, incident } = await setup();
    const { result, unmount } = renderHook(() => useIncidentSurfaces(incident.id), {
      wrapper: wrapperFor(provider),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();

    // @ts-expect-error -- reaching into the private listeners map to assert cleanup
    expect(provider.listeners.get(incident.id)?.size ?? 0).toBe(0);
  });
});
