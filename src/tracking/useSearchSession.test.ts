import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InMemoryProvider } from '../data';
import { createMemoryStore } from './offlineQueue';
import { useSearchSession } from './useSearchSession';
import type { GeoApi, GeoPositionLike } from './useGeolocation';
import type { VisibilityDoc } from './useVisibility';
import type { WakeLockApi } from './useWakeLock';

function createFakeGeoApi(): { api: GeoApi; emit: (position: GeoPositionLike) => void } {
  let successCb: ((position: GeoPositionLike) => void) | null = null;
  const api: GeoApi = {
    watchPosition: (success) => {
      successCb = success;
      return 1;
    },
    clearWatch: () => {},
  };
  return { api, emit: (position) => successCb?.(position) };
}

function createFakeWakeLockApi(): WakeLockApi {
  return {
    async request() {
      return { async release() {} };
    },
  };
}

function createFakeDoc(initial: string): { doc: VisibilityDoc; fire: (state: string) => void } {
  const listeners = new Set<() => void>();
  const doc: VisibilityDoc = {
    visibilityState: initial,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    doc,
    fire: (state: string) => {
      doc.visibilityState = state;
      for (const listener of listeners) listener();
    },
  };
}

function fix(lat: number, lng: number): GeoPositionLike {
  return { coords: { latitude: lat, longitude: lng, accuracy: 5 } };
}

async function setup() {
  const provider = new InMemoryProvider();
  await provider.signInAnonymously('Jamie', 'searcher');
  const incident = await provider.createIncident({
    name: 'Test incident',
    subjectCategory: 'hiker',
    ipp: { lat: 1, lng: 2 },
  });
  const geo = createFakeGeoApi();
  const doc = createFakeDoc('visible');
  // Stable references: constructing these inside the renderHook callback would create a
  // fresh object every render, defeating the wake lock / queue hooks' dependency arrays.
  const wakeLockApi = createFakeWakeLockApi();
  const queueStore = createMemoryStore();
  return { provider, incident, geo, doc, wakeLockApi, queueStore };
}

describe('useSearchSession', () => {
  it('start() creates a session and sets status active', async () => {
    const { provider, incident, geo, doc, wakeLockApi, queueStore } = await setup();
    const { result } = renderHook(() =>
      useSearchSession({
        provider,
        incidentId: incident.id,
        geoApi: geo.api,
        wakeLockApi,
        queueStore,
        doc: doc.doc,
      }),
    );

    await act(async () => {
      await result.current.start('moving');
    });

    expect(result.current.status).toBe('active');
    expect(result.current.session?.incidentId).toBe(incident.id);
  });

  it('emitted GPS points reach the provider via appendTrackPoints', async () => {
    const { provider, incident, geo, doc, wakeLockApi, queueStore } = await setup();
    const { result } = renderHook(() =>
      useSearchSession({
        provider,
        incidentId: incident.id,
        geoApi: geo.api,
        wakeLockApi,
        queueStore,
        doc: doc.doc,
      }),
    );

    await act(async () => {
      await result.current.start('moving');
    });

    act(() => geo.emit(fix(10, 20)));

    await waitFor(async () => {
      const points = await provider.listTrackPoints(incident.id);
      expect(points).toHaveLength(1);
    });

    const points = await provider.listTrackPoints(incident.id);
    expect(points[0]).toMatchObject({ lat: 10, lng: 20 });
    await waitFor(() => expect(result.current.pointsCollected).toBe(1));
    await waitFor(() => expect(result.current.queued).toBe(0));
  });

  it('sets status to paused when the document becomes hidden, and active again when visible', async () => {
    const { provider, incident, geo, doc, wakeLockApi, queueStore } = await setup();
    const { result } = renderHook(() =>
      useSearchSession({
        provider,
        incidentId: incident.id,
        geoApi: geo.api,
        wakeLockApi,
        queueStore,
        doc: doc.doc,
      }),
    );

    await act(async () => {
      await result.current.start('moving');
    });
    expect(result.current.status).toBe('active');

    act(() => doc.fire('hidden'));
    await waitFor(() => expect(result.current.status).toBe('paused'));

    act(() => doc.fire('visible'));
    await waitFor(() => expect(result.current.status).toBe('active'));
  });

  it('end() flushes remaining points, closes the session via provider.endSession, and resets to idle', async () => {
    const { provider, incident, geo, doc, wakeLockApi, queueStore } = await setup();
    const endedSessionIds: string[] = [];
    const originalEndSession = provider.endSession.bind(provider);
    provider.endSession = async (sessionId: string) => {
      endedSessionIds.push(sessionId);
      return originalEndSession(sessionId);
    };

    const { result } = renderHook(() =>
      useSearchSession({
        provider,
        incidentId: incident.id,
        geoApi: geo.api,
        wakeLockApi,
        queueStore,
        doc: doc.doc,
      }),
    );

    await act(async () => {
      await result.current.start('moving');
    });
    const sessionId = result.current.session!.id;

    act(() => geo.emit(fix(5, 6)));
    await waitFor(async () => {
      expect(await provider.listTrackPoints(incident.id)).toHaveLength(1);
    });

    await act(async () => {
      await result.current.end();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.session).toBeNull();
    expect(endedSessionIds).toEqual([sessionId]);
  });
});
