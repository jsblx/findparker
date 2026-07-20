import { describe, expect, it } from 'vitest';
import { OfflineQueue, createMemoryStore } from './offlineQueue';
import type { QueuedPoint } from './offlineQueue';

function point(overrides: Partial<QueuedPoint> = {}): QueuedPoint {
  return {
    sessionId: 'session-1',
    lat: 1,
    lng: 2,
    accuracyM: 5,
    recordedAt: Date.now(),
    ...overrides,
  };
}

describe('OfflineQueue', () => {
  it('enqueues points and reports size/pending', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    expect(await queue.size()).toBe(0);

    await queue.enqueue([point(), point()]);

    expect(await queue.size()).toBe(2);
    expect(await queue.pending()).toHaveLength(2);
  });

  it('clears the queue when flush succeeds', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    await queue.enqueue([point()]);

    const sent: QueuedPoint[][] = [];
    await queue.flush(async (points) => {
      sent.push(points);
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
    expect(await queue.size()).toBe(0);
  });

  it('retains queued points when flush fails, for retry later', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    await queue.enqueue([point()]);

    await expect(
      queue.flush(async () => {
        throw new Error('network down');
      }),
    ).rejects.toThrow('network down');

    expect(await queue.size()).toBe(1);

    // Retry succeeds and clears the queue.
    await queue.flush(async () => {});
    expect(await queue.size()).toBe(0);
  });

  it('is a no-op flush when nothing is queued', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    let called = false;
    await queue.flush(async () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it('accumulates points enqueued across multiple calls', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    await queue.enqueue([point({ lat: 1 })]);
    await queue.enqueue([point({ lat: 2 }), point({ lat: 3 })]);

    expect(await queue.size()).toBe(3);
  });

  it('preserves points enqueued during an in-flight flush and sends only the ones loaded at flush time', async () => {
    const queue = new OfflineQueue(createMemoryStore());
    await queue.enqueue([point({ lat: 1 }), point({ lat: 2 })]); // N = 2

    let sendStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      sendStarted = resolve;
    });
    let resolveSend!: () => void;
    const sendGate = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });
    const sent: QueuedPoint[][] = [];

    const flushPromise = queue.flush(async (points) => {
      sent.push(points);
      sendStarted();
      await sendGate;
    });

    // Wait until `send` has actually started - this guarantees the flush already loaded
    // (and captured) the N points from the store before we enqueue more below.
    await started;

    // Enqueue more points while the flush's `send` is still pending. Store mutations are
    // serialized, so this enqueue is deferred behind the in-flight flush - don't await it
    // before releasing the send, or we'd deadlock; capture the promise and await it after.
    const enqueuePromise = queue.enqueue([point({ lat: 3 }), point({ lat: 4 }), point({ lat: 5 })]); // M = 3

    resolveSend();
    await flushPromise;
    await enqueuePromise;

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(2);
    expect(sent[0].map((p) => p.lat)).toEqual([1, 2]);

    const remaining = await queue.pending();
    expect(remaining).toHaveLength(3);
    expect(remaining.map((p) => p.lat)).toEqual([3, 4, 5]);
  });

  it('serializes overlapping flush calls so they never run concurrently against the store', async () => {
    const store = createMemoryStore();
    const queue = new OfflineQueue(store);
    await queue.enqueue([point({ lat: 1 })]);

    let concurrent = 0;
    let maxConcurrent = 0;
    const order: number[] = [];

    async function send(id: number, points: QueuedPoint[]) {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(id);
      await Promise.resolve();
      concurrent -= 1;
      void points;
    }

    await queue.enqueue([point({ lat: 2 })]);
    const first = queue.flush((points) => send(1, points));
    const second = queue.flush((points) => send(2, points));

    await Promise.all([first, second]);

    expect(maxConcurrent).toBe(1);
    expect(await queue.size()).toBe(0);
  });
});
