import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

describe('refcount stack — conditions', () => {
  it('last-mount-wins through multiple registrations', () => {
    const runtime = createRuntime();
    const seen: ({ id: string } | undefined)[] = [];
    createTrigger<{
      events: { tick: void };
      conditions: { user: { id: string } };
    }>(
      {
        id: 'demo',
        events: ['tick'],
        handler: ({ conditions }) => {
          seen.push(conditions.user);
        },
      },
      runtime,
    );

    const tokenA = runtime.registerCondition('demo', 'user', () => ({ id: 'A' }));
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'A' });

    const tokenB = runtime.registerCondition('demo', 'user', () => ({ id: 'B' }));
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'B' });

    const tokenC = runtime.registerCondition('demo', 'user', () => ({ id: 'C' }));
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'C' });

    // Unmount the middle one (B). C is still on top.
    tokenB.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'C' });

    // Unmount top (C). The previous live registration was A — fall back to it.
    tokenC.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'A' });

    // Unmount the last one. The condition is gone — handler sees undefined.
    tokenA.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toBeUndefined();
  });

  it('StrictMode double-mount: register/register/unregister keeps one alive', () => {
    const runtime = createRuntime();
    const seen: ({ id: string } | undefined)[] = [];
    createTrigger<{
      events: { tick: void };
      conditions: { user: { id: string } };
    }>(
      {
        id: 'sm',
        events: ['tick'],
        handler: ({ conditions }) => {
          seen.push(conditions.user);
        },
      },
      runtime,
    );

    // React StrictMode in dev double-invokes effects: mount → unmount → mount.
    const t1 = runtime.registerCondition('sm', 'user', () => ({ id: 'first' }));
    const t2 = runtime.registerCondition('sm', 'user', () => ({ id: 'second' }));
    t1.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'second' });

    // Idempotent re-unregister must be a no-op.
    t1.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'second' });

    t2.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toBeUndefined();
  });
});

describe('refcount stack — actions', () => {
  it('multiple action handlers — last wins, falls back on unregister', () => {
    const runtime = createRuntime();
    const a = vi.fn();
    const b = vi.fn();
    createTrigger<{ events: { tick: void }; actions: { run: void } }>(
      {
        id: 'act',
        events: ['tick'],
        handler: ({ actions }) => actions.run?.(),
      },
      runtime,
    );

    const tokenA = runtime.registerAction('act', 'run', a);
    const tokenB = runtime.registerAction('act', 'run', b);

    runtime.fireSync('tick');
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();

    tokenB.unregister();
    runtime.fireSync('tick');
    expect(a).toHaveBeenCalledTimes(1);

    tokenA.unregister();
    runtime.fireSync('tick');
    expect(a).toHaveBeenCalledTimes(1); // no handler -> not called
    expect(b).toHaveBeenCalledTimes(1);
  });
});
