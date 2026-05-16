import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

describe('core', () => {
  it('fires single trigger sync — happy path', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<{
      events: { tick: number };
      actions: { log: number };
    }>(
      {
        id: 'demo',
        events: ['tick'],
        handler: ({ event, actions }) => actions.log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('demo', 'log', (n) => log(n));
    runtime.fireSync('tick', 42);
    expect(log).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('skips trigger when required condition missing', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    createTrigger<{
      events: { hi: string };
      conditions: { user: { id: string } };
      actions: { greet: string };
    }>(
      {
        id: 'greeter',
        events: ['hi'],
        required: ['user'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.user) return; // V1: manual narrowing of required conditions
          actions.greet?.(`${conditions.user.id}:${event.payload}`);
        },
      },
      runtime,
    );
    runtime.registerAction('greeter', 'greet', action);
    runtime.fireSync('hi', 'world');
    expect(action).not.toHaveBeenCalled();

    runtime.registerCondition('greeter', 'user', () => ({ id: 'alice' }));
    runtime.fireSync('hi', 'world');
    expect(action).toHaveBeenCalledExactlyOnceWith('alice:world');
  });

  it('records inspector snapshot on fire and on skip', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void }; conditions: { ready: boolean } }>(
      {
        id: 'inspect-me',
        events: ['go'],
        required: ['ready'],
        handler() {
          // no-op
        },
      },
      runtime,
    );

    runtime.fireSync('go');
    const skipped = runtime.getInspectorBuffer()[0];
    expect(skipped?.status).toBe('skipped');
    expect(skipped?.reason).toContain('missing-required-condition:ready');

    runtime.registerCondition('inspect-me', 'ready', () => true);
    runtime.fireSync('go');
    const fired = runtime.getInspectorBuffer()[0];
    expect(fired?.status).toBe('fired');
  });

  it('check.is / check.all / check.any work as expected', () => {
    const runtime = createRuntime();
    const seen: string[] = [];
    createTrigger<{
      events: { e: void };
      conditions: { a: number; b: number };
    }>(
      {
        id: 'check',
        events: ['e'],
        handler: ({ check }) => {
          if (check.is('a', (a) => a > 0)) seen.push('is-a');
          if (check.all({ a: (a) => a > 0, b: (b) => b > 0 })) seen.push('all');
          if (check.any({ a: (a) => a < 0, b: (b) => b > 0 })) seen.push('any-b');
        },
      },
      runtime,
    );
    runtime.registerCondition('check', 'a', () => 1);
    runtime.registerCondition('check', 'b', () => 2);
    runtime.fireSync('e');
    expect(seen).toEqual(['is-a', 'all', 'any-b']);
  });

  it('disable() prevents handler execution', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const trigger = createTrigger<{ events: { x: void }; actions: { go: void } }>(
      {
        id: 'toggle',
        events: ['x'],
        handler: ({ actions }) => actions.go?.(),
      },
      runtime,
    );
    runtime.registerAction('toggle', 'go', action);
    runtime.fireSync('x');
    expect(action).toHaveBeenCalledTimes(1);
    trigger.disable();
    runtime.fireSync('x');
    expect(action).toHaveBeenCalledTimes(1);
    trigger.enable();
    runtime.fireSync('x');
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('isolated runtimes do not share triggers', () => {
    const a = createRuntime();
    const b = createRuntime();
    const logA = vi.fn();
    const logB = vi.fn();
    createTrigger<{ events: { ping: void }; actions: { go: void } }>(
      { id: 'iso', events: ['ping'], handler: ({ actions }) => actions.go?.() },
      a,
    );
    createTrigger<{ events: { ping: void }; actions: { go: void } }>(
      { id: 'iso', events: ['ping'], handler: ({ actions }) => actions.go?.() },
      b,
    );
    a.registerAction('iso', 'go', logA);
    b.registerAction('iso', 'go', logB);
    a.fireSync('ping');
    expect(logA).toHaveBeenCalledTimes(1);
    expect(logB).not.toHaveBeenCalled();
  });

  it('async handler resolves and finalize records fired', async () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<{ events: { p: void }; actions: { ok: void } }>(
      {
        id: 'async',
        events: ['p'],
        handler: async ({ actions }) => {
          await Promise.resolve();
          actions.ok?.();
        },
      },
      runtime,
    );
    runtime.registerAction('async', 'ok', log);
    runtime.fireSync('p');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(log).toHaveBeenCalledTimes(1);
    expect(runtime.getInspectorBuffer()[0]?.status).toBe('fired');
  });

  it('microtask scheduler batches multiple fires', async () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<{ events: { tick: number }; actions: { count: number } }>(
      {
        id: 'batch',
        events: ['tick'],
        handler: ({ event, actions }) => actions.count?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('batch', 'count', (n) => log(n));
    runtime.fire('tick', 1);
    runtime.fire('tick', 2);
    runtime.fire('tick', 3);
    expect(log).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(log).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenNthCalledWith(1, 1);
    expect(log).toHaveBeenNthCalledWith(2, 2);
    expect(log).toHaveBeenNthCalledWith(3, 3);
  });
});
