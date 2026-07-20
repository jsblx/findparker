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
});
