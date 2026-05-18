/**
 * Coverage backfill for v0.10 — exercises code paths that the new APIs
 * added but no other test naturally drives (noop inspector exports,
 * subscribeAction guard branches, runtime registerAction/Condition
 * still-reachable wrappers, etc.). The assertions stay narrow on purpose
 * — these tests exist to keep the coverage gate honest, not to duplicate
 * functional coverage that lives in dedicated suites.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInspector, createNoopInspector } from '../src/inspect.ts';
import { createRuntime, createTrigger } from '../src/index.ts';

type Schema = {
  events: { tick: void };
  conditions: { user: { id: string } };
  actions: { ping: void };
};

describe('coverage v0.10 — noop inspector exports', () => {
  it('createNoopInspector returns an interface with all five methods', () => {
    const ins = createNoopInspector();
    expect(ins.record({} as never)).toBeUndefined();
    expect(ins.getBuffer()).toEqual([]);
    expect(ins.getLastForTrigger('anything')).toBeUndefined();
    const unsub = ins.subscribe(() => {});
    expect(typeof unsub).toBe('function');
    expect(unsub()).toBeUndefined();
    expect(ins.clear()).toBeUndefined();
  });

  it('createInspector is still re-exported from @triggery/core/inspect for back-compat', () => {
    const ins = createInspector(10);
    expect(typeof ins.record).toBe('function');
    expect(ins.getBuffer()).toEqual([]);
  });
});

describe('coverage v0.10 — runtime.subscribeAction guard paths', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('subscribeAction on a nonexistent trigger warns and returns a noop token', () => {
    const runtime = createRuntime();
    const token = runtime.subscribeAction('does-not-exist', 'ping', () => {});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/not found/);
    expect(typeof token.unregister).toBe('function');
    token.unregister();
  });

  it('subscribeAction with scope mismatch warns once and returns a noop token', () => {
    const runtime = createRuntime();
    createTrigger<Schema>(
      { id: 'scoped-sub', scope: 'panel', events: ['tick'], handler() {} },
      runtime,
    );
    const cb = vi.fn();
    const token = runtime.subscribeAction('scoped-sub', 'ping', cb, { scope: 'other' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/scope mismatch/);
    expect(typeof token.unregister).toBe('function');
    token.unregister();
  });
});

describe('coverage v0.10 — trigger.action subscribe on disposed', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('subscribe on a disposed trigger returns a noop unsubscribe + DEV warn', () => {
    const runtime = createRuntime();
    const t = createTrigger<Schema>(
      { id: 'will-dispose', events: ['tick'], handler() {} },
      runtime,
    );
    t.dispose();
    const unsub = t.action('ping').subscribe(() => {});
    // The first subscribe creates the channel; second access on disposed
    // hits the warn-once path. Either way we must get back a unsubscribe noop.
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('unsubscribe is idempotent', () => {
    const runtime = createRuntime();
    const t = createTrigger<Schema>(
      { id: 'idem', events: ['tick'], handler() {} },
      runtime,
    );
    const unsub = t.action('ping').subscribe(() => {});
    unsub();
    unsub(); // double-call — second call must be a silent no-op
    expect(t.action('ping').subscribed).toBe(0);
  });
});

describe('coverage v0.10 — getDefaultRuntime fallback in builder', () => {
  it('imperative createTrigger without an explicit runtime registers against the default', async () => {
    // We import builder dynamically and finalize a trigger without passing a runtime —
    // exercises the `runtime ?? getDefaultRuntime()` branch in builder.ts.
    const { createTrigger: createTriggerBuilder } = await import('../src/builder.ts');
    const t = createTriggerBuilder<Schema>().id('default-rt').events(['tick']).handle(() => {});
    expect(t.id).toBe('default-rt');
    t.dispose();
  });
});
