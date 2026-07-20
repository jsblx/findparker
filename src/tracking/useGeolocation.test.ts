import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGeolocation } from './useGeolocation';
import type { GeoApi, GeoPositionErrorLike, GeoPositionLike } from './useGeolocation';

function createFakeGeoApi(): {
  api: GeoApi;
  emit: (position: GeoPositionLike) => void;
  emitError: (error: GeoPositionErrorLike) => void;
  state: { clearWatchCalls: number };
} {
  let successCb: ((position: GeoPositionLike) => void) | null = null;
  let errorCb: ((error: GeoPositionErrorLike) => void) | null = null;
  const state = { clearWatchCalls: 0 };
  const api: GeoApi = {
    watchPosition: (success, error) => {
      successCb = success;
      errorCb = error;
      return 1;
    },
    clearWatch: () => {
      state.clearWatchCalls += 1;
    },
  };
  return {
    api,
    emit: (position) => successCb?.(position),
    emitError: (error) => errorCb?.(error),
    state,
  };
}

function fix(lat: number, accuracy = 10): GeoPositionLike {
  return { coords: { latitude: lat, longitude: 2, accuracy } };
}

describe('useGeolocation', () => {
  it('discards fixes with worse accuracy than maxAccuracyM', async () => {
    const { api, emit } = createFakeGeoApi();
    const points: number[] = [];
    const { result } = renderHook(() =>
      useGeolocation({ enabled: true, onPoint: (p) => points.push(p.lat), api, maxAccuracyM: 20 }),
    );

    act(() => emit(fix(1, 50)));
    expect(points).toHaveLength(0);
    expect(result.current.lastFix).toBeNull();

    act(() => emit(fix(2, 10)));
    await waitFor(() => expect(result.current.lastFix?.lat).toBe(2));
    expect(points).toEqual([2]);
  });

  it('throttles onPoint to at most one per sampleIntervalMs using injectable now()', async () => {
    let currentTime = 0;
    const now = () => currentTime;
    const { api, emit } = createFakeGeoApi();
    const points: number[] = [];

    renderHook(() =>
      useGeolocation({
        enabled: true,
        onPoint: (p) => points.push(p.lat),
        api,
        now,
        sampleIntervalMs: 1000,
        maxAccuracyM: 100,
      }),
    );

    currentTime = 0;
    act(() => emit(fix(1)));
    currentTime = 500; // inside throttle window - dropped
    act(() => emit(fix(2)));
    currentTime = 1500; // past the window - accepted
    act(() => emit(fix(3)));

    expect(points).toEqual([1, 3]);
  });

  it('updates lastFix on every accepted fix, even throttled ones', async () => {
    let currentTime = 0;
    const now = () => currentTime;
    const { api, emit } = createFakeGeoApi();
    const { result } = renderHook(() =>
      useGeolocation({ enabled: true, onPoint: () => {}, api, now, sampleIntervalMs: 1000, maxAccuracyM: 100 }),
    );

    currentTime = 0;
    act(() => emit(fix(1)));
    await waitFor(() => expect(result.current.lastFix?.lat).toBe(1));

    currentTime = 200;
    act(() => emit(fix(2)));
    await waitFor(() => expect(result.current.lastFix?.lat).toBe(2));
  });

  it('surfaces errors and marks permission denied', async () => {
    const { api, emitError } = createFakeGeoApi();
    const { result } = renderHook(() => useGeolocation({ enabled: true, onPoint: () => {}, api }));

    act(() => emitError({ code: 1, message: 'User denied Geolocation' }));

    await waitFor(() => expect(result.current.error).toBe('User denied Geolocation'));
    expect(result.current.permission).toBe('denied');
  });

  it('reports unsupported when no api is available', () => {
    const { result } = renderHook(() => useGeolocation({ enabled: true, onPoint: () => {}, api: null }));
    expect(result.current.supported).toBe(false);
  });

  it('clears the watch on unmount', () => {
    const { api, state } = createFakeGeoApi();
    const { unmount } = renderHook(() => useGeolocation({ enabled: true, onPoint: () => {}, api }));
    unmount();
    expect(state.clearWatchCalls).toBe(1);
  });
});
