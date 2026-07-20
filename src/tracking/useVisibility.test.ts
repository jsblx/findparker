import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useVisibility } from './useVisibility';
import type { VisibilityDoc } from './useVisibility';

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

describe('useVisibility', () => {
  it('reflects the initial visibility state', () => {
    const { doc } = createFakeDoc('hidden');
    const { result } = renderHook(() => useVisibility({ doc }));
    expect(result.current).toBe(false);
  });

  it('updates when visibilitychange fires', () => {
    const { doc, fire } = createFakeDoc('visible');
    const { result } = renderHook(() => useVisibility({ doc }));
    expect(result.current).toBe(true);

    act(() => fire('hidden'));
    expect(result.current).toBe(false);

    act(() => fire('visible'));
    expect(result.current).toBe(true);
  });

  it('stops listening after unmount', () => {
    const { doc, fire } = createFakeDoc('visible');
    const { result, unmount } = renderHook(() => useVisibility({ doc }));
    unmount();
    act(() => fire('hidden'));
    expect(result.current).toBe(true);
  });
});
