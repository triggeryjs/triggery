import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type AsyncSchema = { events: { tick: number } };

const waitMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('concurrency strategies', () => {
  it('take-latest (default) aborts the previous in-flight run', async () => {
    const runtime = createRuntime();
    const aborted: number[] = [];
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'latest',
        events: ['tick'],
        handler: async ({ event, signal }) => {
          await waitMs(5);
          if (signal.aborted) {
            aborted.push(event.payload);
            return;
          }
          completed.push(event.payload);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await waitMs(20);
    expect(aborted).toEqual([1]);
    expect(completed).toEqual([2]);
  });

  it('take-every never aborts; every run completes', async () => {
    const runtime = createRuntime();
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'every',
        events: ['tick'],
        concurrency: 'take-every',
        handler: async ({ event, signal }) => {
          await waitMs(5);
          if (signal.aborted) throw new Error('should not abort');
          completed.push(event.payload);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    await waitMs(20);
    expect(completed).toEqual([1, 2, 3]);
  });

  it('take-first skips new runs while one is in flight; records reason in inspector', async () => {
    const runtime = createRuntime();
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'first',
        events: ['tick'],
        concurrency: 'take-first',
        handler: async ({ event }) => {
          await waitMs(10);
          completed.push(event.payload);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    // 2nd and 3rd were skipped immediately.
    const buffer = runtime.getInspectorBuffer();
    const skipped = buffer.filter(
      (s) => s.status === 'skipped' && s.reason === 'concurrency-take-first',
    );
    expect(skipped).toHaveLength(2);

    await waitMs(20);
    expect(completed).toEqual([1]);
  });

  it('exhaust behaves like take-first (same gate, different name)', async () => {
    const runtime = createRuntime();
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'exhaust',
        events: ['tick'],
        concurrency: 'exhaust',
        handler: async ({ event }) => {
          await waitMs(10);
          completed.push(event.payload);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await waitMs(20);
    expect(completed).toEqual([1]);
  });

  it('queue serializes runs in submission order', async () => {
    const runtime = createRuntime();
    const order: string[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'q',
        events: ['tick'],
        concurrency: 'queue',
        handler: async ({ event }) => {
          order.push(`start-${event.payload}`);
          await waitMs(5);
          order.push(`end-${event.payload}`);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    await waitMs(50);
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
  });

  it('sync: every run starts immediately without aborting peers', async () => {
    const runtime = createRuntime();
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 's',
        events: ['tick'],
        concurrency: 'sync',
        handler: async ({ event, signal }) => {
          await waitMs(5);
          if (signal.aborted) throw new Error('sync should not abort');
          completed.push(event.payload);
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await waitMs(15);
    expect(completed).toEqual([1, 2]);
  });

  it('a failing queued handler does not break the chain for the next run', async () => {
    const runtime = createRuntime();
    const completed: number[] = [];
    createTrigger<AsyncSchema>(
      {
        id: 'q-err',
        events: ['tick'],
        concurrency: 'queue',
        handler: async ({ event }) => {
          if (event.payload === 1) throw new Error('boom');
          completed.push(event.payload);
        },
      },
      runtime,
    );
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await waitMs(20);
    restore.mockRestore();
    expect(completed).toEqual([2]);
  });
});
