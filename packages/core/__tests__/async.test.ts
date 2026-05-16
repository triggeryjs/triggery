import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

describe('async handler', () => {
  it('take-latest: the second fire aborts the first run', async () => {
    const runtime = createRuntime();
    const aborts: string[] = [];
    const finished = vi.fn();

    createTrigger<{ events: { tick: number } }>(
      {
        id: 'async-take-latest',
        events: ['tick'],
        handler: async ({ event, signal }) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          if (signal.aborted) {
            aborts.push(String(event.payload));
            return;
          }
          finished(event.payload);
        },
      },
      runtime,
    );

    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    expect(aborts).toEqual(['1']); // first call saw the abort
    expect(finished).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('error in async handler ends up as inspector status=errored', async () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void } }>(
      {
        id: 'async-err',
        events: ['go'],
        handler: async () => {
          await Promise.resolve();
          throw new Error('boom');
        },
      },
      runtime,
    );
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime.fireSync('go');
    await Promise.resolve();
    await Promise.resolve();
    restore.mockRestore();
    const last = runtime.getInspectorBuffer()[0];
    expect(last?.status).toBe('errored');
  });
});
