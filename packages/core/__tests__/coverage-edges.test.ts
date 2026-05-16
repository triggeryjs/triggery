/**
 * Tests aimed at branches the main suites didn't reach.
 * Each block here exists to bring a specific uncovered slice up to verified.
 */
import { describe, expect, it, vi } from 'vitest';
import { createCheck, createRuntime, createScheduler, createTrigger } from '../src/index.ts';

describe('check helpers — null / undefined / empty-map branches', () => {
  it('is returns false for null condition value', () => {
    const ctx = createCheck<{ a?: number | null }>({ a: null });
    expect(ctx.is('a', (n) => n > 0)).toBe(false);
  });

  it('all returns true for an empty predicate map', () => {
    const ctx = createCheck<{ a?: number }>({ a: 1 });
    expect(ctx.all({})).toBe(true);
  });

  it('all skips undefined predicates', () => {
    const ctx = createCheck<{ a?: number; b?: number }>({ a: 1, b: 2 });
    // exactOptionalPropertyTypes forbids { b: undefined } on a Partial — cast
    // through unknown to reach the runtime `if (!predicate) continue;` branch.
    const map = { a: (n: number) => n > 0, b: undefined } as unknown as {
      a?: (n: number) => boolean;
      b?: (n: number) => boolean;
    };
    expect(ctx.all(map)).toBe(true);
  });

  it('all returns false when value is null', () => {
    const ctx = createCheck<{ a?: number | null }>({ a: null });
    expect(ctx.all({ a: (n) => n > 0 })).toBe(false);
  });

  it('all returns false when predicate returns false', () => {
    const ctx = createCheck<{ a?: number }>({ a: 1 });
    expect(ctx.all({ a: (n) => n > 100 })).toBe(false);
  });

  it('any skips undefined predicates and null values', () => {
    // exactOptionalPropertyTypes forbids { a: undefined } on a Partial — cast
    // through unknown to reach the runtime `if (!predicate) continue;` branch.
    const ctxA = createCheck<{ a?: number }>({ a: 1 });
    const undefMap = { a: undefined } as unknown as { a?: (n: number) => boolean };
    expect(ctxA.any(undefMap)).toBe(false);
    const ctxB = createCheck<{ a?: number | null }>({ a: null });
    expect(ctxB.any({ a: (n) => n > 0 })).toBe(false);
  });

  it('any returns false when no predicate matches (or all conditions absent)', () => {
    const ctx = createCheck<{ a?: number; b?: string }>({ a: 1 });
    expect(ctx.any({ a: (n) => n > 100, b: (s) => s === 'x' })).toBe(false);
    expect(ctx.any({})).toBe(false);
  });

  it('any returns true on the first matching predicate', () => {
    const ctx = createCheck<{ a?: number; b?: number }>({ a: 0, b: 5 });
    expect(ctx.any({ a: (n) => n > 100, b: (n) => n > 0 })).toBe(true);
  });
});

describe('createTrigger public methods — fallback branches after dispose', () => {
  it('isEnabled returns false after dispose (getTrigger ?? false branch)', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { go: void } }>(
      { id: 'is-enabled-fallback', events: ['go'], handler() {} },
      runtime,
    );
    expect(t.isEnabled()).toBe(true);
    t.dispose();
    expect(t.isEnabled()).toBe(false);
    expect(t.inspect()).toBeUndefined();
  });

  it('enable() / disable() on a disposed trigger are silent no-ops', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { go: void } }>(
      { id: 'noop-after-dispose', events: ['go'], handler() {} },
      runtime,
    );
    t.dispose();
    expect(() => t.enable()).not.toThrow();
    expect(() => t.disable()).not.toThrow();
  });
});

describe('inspector — getLastForTrigger via trigger.inspect() & listener throw', () => {
  it('trigger.inspect() returns the latest snapshot for that trigger', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { ping: number } }>(
      { id: 'inspect-edge', events: ['ping'], handler() {} },
      runtime,
    );
    runtime.fireSync('ping', 42);
    expect(t.inspect()?.triggerId).toBe('inspect-edge');
    expect(t.inspect()?.status).toBe('fired');
  });

  it('a throwing subscribe-listener does not bring the runtime down', () => {
    const runtime = createRuntime();
    const sub = runtime.subscribe(() => {
      throw new Error('listener boom');
    });
    createTrigger<{ events: { ping: void } }>(
      { id: 'listener-boom', events: ['ping'], handler() {} },
      runtime,
    );
    expect(() => runtime.fireSync('ping')).not.toThrow();
    sub.unregister();
  });
});

describe('scheduler — microtask task error is logged but does not stop the queue', () => {
  it('logs and continues when a scheduled task throws', async () => {
    const scheduler = createScheduler('microtask');
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = vi.fn();
    scheduler.enqueue(() => {
      throw new Error('task boom');
    });
    scheduler.enqueue(ok);
    await Promise.resolve();
    restore.mockRestore();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('sync scheduler flush is a no-op', () => {
    const scheduler = createScheduler('sync');
    expect(() => scheduler.flush()).not.toThrow();
  });

  it('trigger with schedule:"sync" goes through syncScheduler.enqueue on fire()', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<{ events: { go: void } }>(
      { id: 'sync-sched', events: ['go'], schedule: 'sync', handler: () => log() },
      runtime,
    );
    // `fire` (not `fireSync`) routes through trigger.config.schedule.
    // sync trigger → syncScheduler.enqueue → task() invoked immediately.
    runtime.fire('go');
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('conditions proxy — has / ownKeys / getOwnPropertyDescriptor traps', () => {
  it('exposes registered conditions via `in`, Object.keys and descriptors', () => {
    const runtime = createRuntime();
    const seen = vi.fn();
    createTrigger<{ events: { go: void }; conditions: { a: number; b: number } }>(
      {
        id: 'proxy-traps',
        events: ['go'],
        handler: ({ conditions }) => {
          const a: number | undefined = conditions.a;
          const hasB = 'b' in conditions;
          const keys = Object.keys(conditions);
          seen({ a, hasB, keys });
        },
      },
      runtime,
    );
    runtime.registerCondition('proxy-traps', 'a', () => 1);
    runtime.registerCondition('proxy-traps', 'b', () => 2);
    runtime.fireSync('go');
    expect(seen).toHaveBeenCalledWith({ a: 1, hasB: true, keys: ['a', 'b'] });
  });
});

describe('actions proxy — `in` trap on immediate and timed proxies', () => {
  it('`name in actions` reflects registered actions', () => {
    const runtime = createRuntime();
    const seen = vi.fn();
    createTrigger<{ events: { go: void }; actions: { hit: void; miss: void } }>(
      {
        id: 'actions-in',
        events: ['go'],
        handler: ({ actions }) =>
          seen({
            hasHit: 'hit' in actions,
            hasMiss: 'miss' in actions,
            hasOnDebounced: 'hit' in actions.debounce(100),
          }),
      },
      runtime,
    );
    runtime.registerAction('actions-in', 'hit', () => {});
    runtime.fireSync('go');
    expect(seen).toHaveBeenCalledWith({ hasHit: true, hasMiss: false, hasOnDebounced: true });
  });
});

describe('action invocation — async path through middleware', () => {
  it('onActionEnd fires for an async action handler that returns a Promise', async () => {
    const ends: string[] = [];
    const runtime = createRuntime({
      middleware: [{ name: 'spy', onActionEnd: (c) => ends.push(c.actionName) }],
    });
    createTrigger<{ events: { go: void }; actions: { work: void } }>(
      {
        id: 'async-action',
        events: ['go'],
        handler: ({ actions }) => actions.work?.(),
      },
      runtime,
    );
    runtime.registerAction('async-action', 'work', async () => {
      await Promise.resolve();
    });
    runtime.fireSync('go');
    await Promise.resolve();
    await Promise.resolve();
    expect(ends).toEqual(['work']);
  });

  it('onError fires when an async action handler rejects', async () => {
    const errors: unknown[] = [];
    const runtime = createRuntime({
      middleware: [{ name: 'spy', onError: (c) => errors.push(c.error) }],
    });
    createTrigger<{ events: { go: void }; actions: { boom: void } }>(
      {
        id: 'async-err',
        events: ['go'],
        handler: ({ actions }) => actions.boom?.(),
      },
      runtime,
    );
    runtime.registerAction('async-err', 'boom', async () => {
      throw new Error('async kaboom');
    });
    runtime.fireSync('go');
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('async kaboom');
  });
});

describe('handler error paths', () => {
  it('sync handler throw is logged and recorded as errored', () => {
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {});
    const runtime = createRuntime();
    createTrigger<{ events: { go: void } }>(
      {
        id: 'sync-throw',
        events: ['go'],
        handler: () => {
          throw new Error('sync boom');
        },
      },
      runtime,
    );
    runtime.fireSync('go');
    restore.mockRestore();
    expect(runtime.getInspectorBuffer()[0]?.status).toBe('errored');
  });
});

describe('public trigger from getTrigger — namedHooks throw + dispose cleanup', () => {
  it('namedHooks() on a runtime-derived public trigger throws', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void } }>({ id: 'pub', events: ['go'], handler() {} }, runtime);
    const pub = runtime.getTrigger('pub');
    expect(() => pub?.namedHooks()).toThrow(/can only be called on the original trigger/);
  });

  it('dispose() on a runtime-derived public trigger disables it and aborts in-flight', async () => {
    const runtime = createRuntime();
    const aborted = vi.fn();
    createTrigger<{ events: { go: void } }>(
      {
        id: 'pub-dispose',
        events: ['go'],
        handler: async ({ signal }) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          if (signal.aborted) aborted();
        },
      },
      runtime,
    );
    runtime.fireSync('go');
    const pub = runtime.getTrigger('pub-dispose');
    pub?.dispose();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(aborted).toHaveBeenCalledTimes(1);
    expect(pub?.isEnabled()).toBe(false);
  });
});

describe('createTrigger public methods — disable/inspect/namedHooks', () => {
  it('inspect() returns the latest snapshot', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { ping: number } }>(
      { id: 'pub-inspect', events: ['ping'], handler() {} },
      runtime,
    );
    runtime.fireSync('ping', 1);
    expect(t.inspect()?.eventName).toBe('ping');
  });

  it('namedHooks() proxy throws when accessed without the React bindings', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { ping: void } }>(
      { id: 'pub-hooks', events: ['ping'], handler() {} },
      runtime,
    );
    const proxy = t.namedHooks();
    expect(() => proxy.usePingEvent).toThrow(/requires @triggery\/react/);
  });
});

describe('async handler — abort path during a rejection', () => {
  it('records status="aborted" when the controller aborts before the handler rejects', async () => {
    const runtime = createRuntime();
    let count = 0;
    createTrigger<{ events: { tick: number } }>(
      {
        id: 'abort-reject',
        events: ['tick'],
        handler: async ({ signal }) => {
          const stamp = ++count;
          // The first run's await is interrupted by the second fire which
          // calls controller.abort('superseded-by-latest'). When we reach the
          // throwIfAborted, the rejection branch handles status="aborted".
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          if (stamp === 1) signal.throwIfAborted();
        },
      },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    const aborted = runtime.getInspectorBuffer().find((s) => s.status === 'aborted');
    expect(aborted?.reason).toContain('superseded-by-latest');
  });
});
