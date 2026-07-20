import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';
import type { VisibilityDoc } from './useVisibility';
import type { WakeLockApi } from './useWakeLock';

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

function createFakeWakeLockApi(): { api: WakeLockApi; state: { releaseCalls: number; requestCalls: number } } {
  const state = { releaseCalls: 0, requestCalls: 0 };
  const api: WakeLockApi = {
    async request() {
      state.requestCalls += 1;
      return {
        async release() {
          state.releaseCalls += 1;
        },
      };
    },
  };
  return { api, state };
}

describe('useWakeLock', () => {
  it('reports unsupported when no api is available', () => {
    const { result } = renderHook(() => useWakeLock(true, { api: null }));
    expect(result.current.supported).toBe(false);
    expect(result.current.active).toBe(false);
  });

  it('requests a lock when active becomes true', async () => {
    const { api, state } = createFakeWakeLockApi();
    const { result } = renderHook(() => useWakeLock(true, { api }));

    await waitFor(() => expect(result.current.active).toBe(true));
    expect(state.requestCalls).toBe(1);
  });

  it('releases the lock when active becomes false', async () => {
    const { api, state } = createFakeWakeLockApi();
    const { result, rerender } = renderHook(({ active }) => useWakeLock(active, { api }), {
      initialProps: { active: true },
    });
    await waitFor(() => expect(result.current.active).toBe(true));

    rerender({ active: false });
    await waitFor(() => expect(result.current.active).toBe(false));
    expect(state.releaseCalls).toBe(1);
  });

  it('re-acquires the lock on visibilitychange -> visible', async () => {
    const { api, state } = createFakeWakeLockApi();
    const { doc, fire } = createFakeDoc('visible');
    const { result } = renderHook(() => useWakeLock(true, { api, doc }));

    await waitFor(() => expect(result.current.active).toBe(true));
    expect(state.requestCalls).toBe(1);

    act(() => fire('hidden'));
    act(() => fire('visible'));

    await waitFor(() => expect(state.requestCalls).toBe(2));
  });

  it('surfaces an error when the request rejects', async () => {
    const api: WakeLockApi = {
      request: vi.fn().mockRejectedValue(new Error('denied by browser')),
    };
    const { result } = renderHook(() => useWakeLock(true, { api }));

    await waitFor(() => expect(result.current.error).toBe('denied by browser'));
    expect(result.current.active).toBe(false);
  });
});
