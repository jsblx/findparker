/**
 * Offline-first buffer for GPS breadcrumbs. Points are queued to durable storage before
 * any network attempt, so a dead zone (or a killed tab) never loses data - `flush` only
 * clears the queue once the caller's `send` has resolved successfully.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { TrackPoint } from '../types';

export type QueuedPoint = Omit<TrackPoint, 'id'>;

export interface QueueStore {
  load(): Promise<QueuedPoint[]>;
  save(points: QueuedPoint[]): Promise<void>;
  clear(): Promise<void>;
}

const STORE_NAME = 'pending-points';
const RECORD_KEY = 'queue';

/** Production QueueStore backed by IndexedDB (via `idb`). The whole pending array lives under one key. */
export function createIdbStore(dbName = 'findparker-tracking'): QueueStore {
  let dbPromise: Promise<IDBPDatabase> | null = null;

  function getDb(): Promise<IDBPDatabase> {
    if (!dbPromise) {
      dbPromise = openDB(dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });
    }
    return dbPromise;
  }

  return {
    async load() {
      const db = await getDb();
      const points = await db.get(STORE_NAME, RECORD_KEY);
      return (points as QueuedPoint[] | undefined) ?? [];
    },
    async save(points) {
      const db = await getDb();
      await db.put(STORE_NAME, points, RECORD_KEY);
    },
    async clear() {
      const db = await getDb();
      await db.delete(STORE_NAME, RECORD_KEY);
    },
  };
}

/** In-memory QueueStore for tests and other non-persistent uses. */
export function createMemoryStore(): QueueStore {
  let points: QueuedPoint[] = [];
  return {
    async load() {
      return [...points];
    },
    async save(next) {
      points = [...next];
    },
    async clear() {
      points = [];
    },
  };
}

/** Wraps a QueueStore with enqueue/flush semantics so callers never touch storage directly. */
export class OfflineQueue {
  constructor(private readonly store: QueueStore) {}

  async enqueue(points: QueuedPoint[]): Promise<void> {
    if (points.length === 0) return;
    const existing = await this.store.load();
    await this.store.save([...existing, ...points]);
  }

  async size(): Promise<number> {
    return (await this.store.load()).length;
  }

  async pending(): Promise<QueuedPoint[]> {
    return this.store.load();
  }

  /**
   * Loads whatever is queued and hands it to `send`. Clears the queue only on success;
   * on failure the points remain queued so the next flush attempt (e.g. on 'online') retries them.
   */
  async flush(send: (points: QueuedPoint[]) => Promise<void>): Promise<void> {
    const points = await this.store.load();
    if (points.length === 0) return;
    await send(points);
    await this.store.clear();
  }
}
