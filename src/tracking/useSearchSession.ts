/**
 * Orchestrates a full volunteer search session: starts/ends it against the DataProvider,
 * streams accepted GPS fixes through an offline queue so dead zones never lose data, keeps
 * the screen awake while active, and pauses/resumes tracking as the app is backgrounded.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataProvider } from '../data/DataProvider';
import type { SearchSession, SessionMode } from '../types';
import { OfflineQueue, createIdbStore, type QueueStore, type QueuedPoint } from './offlineQueue';
import { useGeolocation, type GeoApi, type GeoPoint } from './useGeolocation';
import { useWakeLock, type WakeLockApi } from './useWakeLock';
import { useVisibility } from './useVisibility';
import type { VisibilityDoc } from './useVisibility';

export type SessionStatus = 'idle' | 'active' | 'paused';

export interface UseSearchSessionOptions {
  provider: DataProvider;
  incidentId: string;
  /** Injectable browser API seams, primarily for tests - default to real browser implementations. */
  geoApi?: GeoApi | null;
  wakeLockApi?: WakeLockApi | null;
  queueStore?: QueueStore;
  doc?: VisibilityDoc;
  sampleIntervalMs?: number;
  maxAccuracyM?: number;
  now?: () => number;
}

export interface UseSearchSessionResult {
  status: SessionStatus;
  session: SearchSession | null;
  pointsCollected: number;
  queued: number;
  wakeLockActive: boolean;
  supported: { geolocation: boolean; wakeLock: boolean };
  error: string | null;
  start: (mode: SessionMode) => Promise<void>;
  end: () => Promise<void>;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useSearchSession(opts: UseSearchSessionOptions): UseSearchSessionResult {
  const { provider, incidentId } = opts;

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [session, setSession] = useState<SearchSession | null>(null);
  const [pointsCollected, setPointsCollected] = useState(0);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<SearchSession | null>(null);
  const [queue] = useState(() => new OfflineQueue(opts.queueStore ?? createIdbStore()));

  const refreshQueued = useCallback(async () => {
    setQueued(await queue.size());
  }, [queue]);

  const flush = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    try {
      await queue.flush((points: QueuedPoint[]) => provider.appendTrackPoints(activeSession.id, points));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to sync track points'));
    } finally {
      await refreshQueued();
    }
  }, [provider, queue, refreshQueued]);

  const handlePoint = useCallback(
    (point: GeoPoint) => {
      const activeSession = sessionRef.current;
      if (!activeSession) return;
      const queuedPoint: QueuedPoint = { sessionId: activeSession.id, ...point };
      void (async () => {
        try {
          await queue.enqueue([queuedPoint]);
          setPointsCollected((n) => n + 1);
          await refreshQueued();
          await flush();
        } catch (err) {
          setError(errorMessage(err, 'Failed to queue track point'));
        }
      })();
    },
    [queue, flush, refreshQueued],
  );

  const trackingEnabled = status === 'active';

  const geo = useGeolocation({
    enabled: trackingEnabled,
    onPoint: handlePoint,
    api: opts.geoApi,
    sampleIntervalMs: opts.sampleIntervalMs,
    maxAccuracyM: opts.maxAccuracyM,
    now: opts.now,
  });

  const wakeLock = useWakeLock(trackingEnabled, { api: opts.wakeLockApi, doc: opts.doc });

  const visible = useVisibility({ doc: opts.doc });

  // Screen wake locks and geolocation both naturally follow `trackingEnabled`; visibility
  // only needs to flip status between 'active' and 'paused' while a session is open.
  useEffect(() => {
    if (!sessionRef.current) return;
    if (!visible && status === 'active') {
      setStatus('paused');
    } else if (visible && status === 'paused') {
      setStatus('active');
      void flush();
    }
  }, [visible, status, flush]);

  useEffect(() => {
    function onOnline() {
      void flush();
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  const start = useCallback(
    async (mode: SessionMode) => {
      try {
        const newSession = await provider.startSession(incidentId, mode);
        sessionRef.current = newSession;
        setSession(newSession);
        setPointsCollected(0);
        setError(null);
        await refreshQueued();
        setStatus('active');
      } catch (err) {
        setError(errorMessage(err, 'Failed to start session'));
      }
    },
    [provider, incidentId, refreshQueued],
  );

  const end = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      setStatus('idle');
      return;
    }
    await flush();
    try {
      await provider.endSession(activeSession.id);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to end session'));
    } finally {
      sessionRef.current = null;
      setSession(null);
      setStatus('idle');
    }
  }, [flush, provider]);

  return {
    status,
    session,
    pointsCollected,
    queued,
    wakeLockActive: wakeLock.active,
    supported: { geolocation: geo.supported, wakeLock: wakeLock.supported },
    error: error ?? geo.error ?? wakeLock.error,
    start,
    end,
  };
}
