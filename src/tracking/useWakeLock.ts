/**
 * Keeps the screen awake for the duration of an active search session via the Screen Wake
 * Lock API. Wake locks are automatically released by the browser whenever the page is
 * hidden, so this hook re-acquires on `visibilitychange` -> visible while `active` is true.
 */
import { useEffect, useRef, useState } from 'react';
import { defaultVisibilityDoc, type VisibilityDoc } from './useVisibility';

export interface WakeLockSentinelLike {
  release(): Promise<void>;
}

export interface WakeLockApi {
  request(): Promise<WakeLockSentinelLike>;
}

/** Default WakeLockApi backed by `navigator.wakeLock`. Returns null when unsupported. */
export function createDefaultWakeLockApi(): WakeLockApi | null {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return null;
  }
  return {
    async request() {
      const sentinel = await navigator.wakeLock.request('screen');
      return { release: () => sentinel.release() };
    },
  };
}

export interface UseWakeLockOptions {
  api?: WakeLockApi | null;
  doc?: VisibilityDoc;
}

export interface UseWakeLockResult {
  supported: boolean;
  active: boolean;
  error: string | null;
}

export function useWakeLock(active: boolean, opts: UseWakeLockOptions = {}): UseWakeLockResult {
  const api = opts.api === undefined ? createDefaultWakeLockApi() : opts.api;
  const doc = opts.doc ?? defaultVisibilityDoc();
  const supported = api !== null;

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active || !api) {
      setIsActive(false);
      return;
    }

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await api!.request();
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setIsActive(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setIsActive(false);
          setError(err instanceof Error ? err.message : 'Failed to acquire wake lock');
        }
      }
    }

    void acquire();

    function onVisibilityChange() {
      if (!cancelled && doc?.visibilityState === 'visible') {
        void acquire();
      }
    }

    doc?.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        void sentinel.release();
      }
      setIsActive(false);
    };
  }, [active, api, doc]);

  return { supported, active: isActive, error };
}
