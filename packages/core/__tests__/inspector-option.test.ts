import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

/**
 * Tests for the `inspector` runtime option:
 *
 *   undefined          → DEV on, PROD off (auto)
 *   true               → always on
 *   false              → always off
 *   { dev?, prod? }    → per-env override, unset fields fall back to auto
 *
 * Vitest doesn't expose `process.env.NODE_ENV` mutation as a first-class API;
 * we save/restore it around each case to assert both DEV and PROD branches.
 */

// Concrete-typed alias so both Biome (useLiteralKeys) and TS strict
// (noPropertyAccessFromIndexSignature + exactOptionalPropertyTypes) accept
// dot-notation access and `string | undefined` assignment.
const env = process.env as { NODE_ENV: string | undefined };

describe('runtime — inspector option', () => {
  const savedNodeEnv = env.NODE_ENV;

  beforeEach(() => {
    env.NODE_ENV = savedNodeEnv;
  });

  afterEach(() => {
    env.NODE_ENV = savedNodeEnv;
  });

  const setupFires = (runtime: ReturnType<typeof createRuntime>) => {
    let calls = 0;
    createTrigger<{ events: { go: void }; actions: { tick: void } }>(
      {
        id: 'opt-test',
        events: ['go'],
        handler({ actions }) {
          actions.tick?.();
        },
      },
      runtime,
    );
    runtime.registerAction('opt-test', 'tick', () => {
      calls++;
    });
    return () => {
      runtime.fireSync('go');
      return calls;
    };
  };

  it('default in DEV: inspector enabled, snapshots flow', () => {
    env.NODE_ENV = 'development';
    const runtime = createRuntime();
    expect(runtime.inspectorEnabled).toBe(true);

    const seen: string[] = [];
    runtime.subscribe((s) => seen.push(s.triggerId));
    const fire = setupFires(runtime);
    expect(fire()).toBe(1);
    expect(seen).toEqual(['opt-test']);
    expect(runtime.getInspectorBuffer()).toHaveLength(1);
  });

  it('default in PROD: inspector disabled — no snapshots, no subscribe callbacks', () => {
    env.NODE_ENV = 'production';
    const runtime = createRuntime();
    expect(runtime.inspectorEnabled).toBe(false);

    const listener = vi.fn();
    runtime.subscribe(listener);
    const fire = setupFires(runtime);
    expect(fire()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(runtime.getInspectorBuffer()).toEqual([]);
  });

  it('`inspector: true` forces enabled in PROD', () => {
    env.NODE_ENV = 'production';
    const runtime = createRuntime({ inspector: true });
    expect(runtime.inspectorEnabled).toBe(true);

    const listener = vi.fn();
    runtime.subscribe(listener);
    const fire = setupFires(runtime);
    expect(fire()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getInspectorBuffer()).toHaveLength(1);
  });

  it('`inspector: false` forces disabled in DEV', () => {
    env.NODE_ENV = 'development';
    const runtime = createRuntime({ inspector: false });
    expect(runtime.inspectorEnabled).toBe(false);

    const listener = vi.fn();
    runtime.subscribe(listener);
    const fire = setupFires(runtime);
    expect(fire()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(runtime.getInspectorBuffer()).toEqual([]);
  });

  it('`inspector: { dev: false }` disables DEV but leaves PROD at auto (off)', () => {
    env.NODE_ENV = 'development';
    const devRuntime = createRuntime({ inspector: { dev: false } });
    expect(devRuntime.inspectorEnabled).toBe(false);

    env.NODE_ENV = 'production';
    const prodRuntime = createRuntime({ inspector: { dev: false } });
    expect(prodRuntime.inspectorEnabled).toBe(false);
  });

  it('`inspector: { prod: true }` enables PROD but leaves DEV at auto (on)', () => {
    env.NODE_ENV = 'production';
    const prodRuntime = createRuntime({ inspector: { prod: true } });
    expect(prodRuntime.inspectorEnabled).toBe(true);

    env.NODE_ENV = 'development';
    const devRuntime = createRuntime({ inspector: { prod: true } });
    expect(devRuntime.inspectorEnabled).toBe(true);
  });

  it('`inspector: { dev: true, prod: false }` makes the auto default explicit', () => {
    env.NODE_ENV = 'development';
    const devRuntime = createRuntime({ inspector: { dev: true, prod: false } });
    expect(devRuntime.inspectorEnabled).toBe(true);

    env.NODE_ENV = 'production';
    const prodRuntime = createRuntime({ inspector: { dev: true, prod: false } });
    expect(prodRuntime.inspectorEnabled).toBe(false);
  });

  it('trigger.inspect() returns undefined when inspector is off', () => {
    const runtime = createRuntime({ inspector: false });
    const trigger = createTrigger<{ events: { go: void } }>(
      {
        id: 'inspect-off',
        events: ['go'],
        handler() {},
      },
      runtime,
    );
    runtime.fireSync('go');
    expect(trigger.inspect()).toBeUndefined();
  });

  it('subscribe returns a working unregister even when inspector is off', () => {
    const runtime = createRuntime({ inspector: false });
    const token = runtime.subscribe(() => {});
    expect(() => token.unregister()).not.toThrow();
    // Idempotent
    expect(() => token.unregister()).not.toThrow();
  });
});
