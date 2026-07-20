/**
 * Regression tests: when no `api` override is passed, useGeolocation/useWakeLock must memoize
 * the default browser-backed API so it keeps a stable identity across renders. Otherwise their
 * effects (which list `api` as a dependency) re-subscribe on every render - which for
 * geolocation resets the sample throttle and fires points in a runaway loop, and for the wake
 * lock releases/re-acquires endlessly.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';
import { useWakeLock } from './useWakeLock';

afterEach(() => {
  vi.restoreAllMocks();
});

function stubNavigatorProp(prop: string, value: unknown): void {
  Object.defineProperty(navigator, prop, { value, configurable: true });
}

describe('default API stability', () => {
  it('useGeolocation subscribes watchPosition exactly once across re-renders (default api)', () => {
    const watchPosition = vi.fn().mockReturnValue(1);
    const clearWatch = vi.fn();
    stubNavigatorProp('geolocation', { watchPosition, clearWatch });

    const { rerender } = renderHook(() => useGeolocation({ enabled: true, onPoint: () => {} }));
    // Force several re-renders with no dependency changes.
    rerender();
    rerender();
    rerender();

    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('useWakeLock requests the lock exactly once across re-renders (default api)', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release: () => release() });
    stubNavigatorProp('wakeLock', { request });

    const { rerender } = renderHook(() => useWakeLock(true));
    // Wrap in act: the wake lock acquire updates state asynchronously.
    await act(async () => {
      rerender();
      rerender();
      rerender();
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });
});
