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
  /** Chains all store mutations (enqueue + flush) so they never race against each other. */
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly store: QueueStore) {}

  /** Runs `op` after any prior queued operation settles, so store reads/writes stay serialized. */
  private serialize<T>(op: () => Promise<T>): Promise<T> {
    const run = this.tail.catch(() => undefined).then(op);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async enqueue(points: QueuedPoint[]): Promise<void> {
    if (points.length === 0) return;
    return this.serialize(async () => {
      const existing = await this.store.load();
      await this.store.save([...existing, ...points]);
    });
  }

  async size(): Promise<number> {
    return (await this.store.load()).length;
  }

  async pending(): Promise<QueuedPoint[]> {
    return this.store.load();
  }

  /**
   * Loads whatever is queued and hands it to `send`. Only the points that were actually
   * handed to `send` are removed afterward - anything enqueued while `send` was in flight
   * is appended after them in storage and survives. Clears nothing on failure, so the
   * points remain queued for the next flush attempt (e.g. on 'online') to retry.
   *
   * Calls are serialized: each flush waits for any previous one to settle before loading
   * the store, so concurrent callers never race or double-send.
   */
  async flush(send: (points: QueuedPoint[]) => Promise<void>): Promise<void> {
    return this.serialize(() => this.doFlush(send));
  }

  private async doFlush(send: (points: QueuedPoint[]) => Promise<void>): Promise<void> {
    const points = await this.store.load();
    if (points.length === 0) return;
    await send(points);
    const after = await this.store.load();
    await this.store.save(after.slice(points.length));
  }
}
