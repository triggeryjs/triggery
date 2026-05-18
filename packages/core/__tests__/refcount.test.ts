import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

/**
 * v0.10 simplified semantics: each `(trigger, name)` slot holds **one**
 * registration. The most recent call wins; `unregister()` removes the
 * registration only if it's still the live one (no stack fallback).
 */
describe('refcount — conditions', () => {
  it('last write wins through multiple registrations', () => {
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

    runtime.registerCondition('demo', 'user', () => ({ id: 'B' }));
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'B' });

    const tokenC = runtime.registerCondition('demo', 'user', () => ({ id: 'C' }));
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'C' });

    // Stale unregister on A (current registration is C) — no-op.
    tokenA.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toEqual({ id: 'C' });

    // Unregister C (the live one) — condition is gone.
    tokenC.unregister();
    runtime.fireSync('tick');
    expect(seen.at(-1)).toBeUndefined();
  });

  it('StrictMode double-mount: register/register/unregister keeps the latest alive', () => {
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
    // The first mount's unregister fires *after* the second mount registers,
    // so its token is stale by then and the second registration survives.
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

describe('refcount — actions', () => {
  it('last action handler wins; stale unregister is a no-op', () => {
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

    // Stale unregister on A — current is B, so no-op.
    tokenA.unregister();
    runtime.fireSync('tick');
    expect(b).toHaveBeenCalledTimes(2);
    expect(a).not.toHaveBeenCalled();

    tokenB.unregister();
    runtime.fireSync('tick');
    expect(b).toHaveBeenCalledTimes(2);
    expect(a).not.toHaveBeenCalled(); // a was unregistered already
  });
});
