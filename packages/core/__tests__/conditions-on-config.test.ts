import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type Schema = {
  events: { ping: number };
  conditions: { user: { id: string }; settings: { sound: boolean } };
  actions: { greet: string };
};

describe('B1 — conditions on config', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('registers each condition declared in conditions: config', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 't1',
        events: ['ping'],
        conditions: { user: null, settings: { sound: true } },
        required: ['user', 'settings'],
        handler({ event, conditions, actions }) {
          if (!conditions.user || !conditions.settings) return;
          actions.greet?.(`${conditions.user.id}:${event.payload}`);
        },
      },
      runtime,
    );
    runtime.registerAction('t1', 'greet', action);

    // user still null — handler is gated by required
    runtime.fireSync('ping', 1);
    expect(action).not.toHaveBeenCalled();

    t.setCondition('user', { id: 'alice' });
    runtime.fireSync('ping', 2);
    expect(action).toHaveBeenCalledExactlyOnceWith('alice:2');
  });

  it('setCondition updates the value seen by subsequent fires', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 't2',
        events: ['ping'],
        conditions: { user: { id: 'alice' }, settings: { sound: true } },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('t2', 'greet', action);

    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenLastCalledWith('alice');

    t.setCondition('user', { id: 'bob' });
    runtime.fireSync('ping', 2);
    expect(action).toHaveBeenLastCalledWith('bob');
  });

  it('mixed config + external registerCondition: both keys work', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    let external = 'ext-1';
    const t = createTrigger<{
      events: { ping: void };
      conditions: { local: number; external: string };
      actions: { go: string };
    }>(
      {
        id: 't3',
        events: ['ping'],
        conditions: { local: 42 },
        required: ['local', 'external'],
        handler({ conditions, actions }) {
          if (!conditions.local || !conditions.external) return;
          actions.go?.(`${conditions.local}/${conditions.external}`);
        },
      },
      runtime,
    );
    runtime.registerAction('t3', 'go', action);
    runtime.registerCondition('t3', 'external', () => external);

    runtime.fireSync('ping');
    expect(action).toHaveBeenLastCalledWith('42/ext-1');

    t.setCondition('local', 100);
    external = 'ext-2';
    runtime.fireSync('ping');
    expect(action).toHaveBeenLastCalledWith('100/ext-2');
  });

  it('treats null/undefined as unset — required keys block dispatch', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 't4',
        events: ['ping'],
        conditions: { user: null, settings: null },
        required: ['user', 'settings'],
        handler({ conditions, actions }) {
          if (!conditions.user || !conditions.settings) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('t4', 'greet', action);

    // both null — blocked
    runtime.fireSync('ping', 1);
    expect(action).not.toHaveBeenCalled();

    // user set, settings still null — blocked
    t.setCondition('user', { id: 'alice' });
    runtime.fireSync('ping', 2);
    expect(action).not.toHaveBeenCalled();

    // both set — runs
    t.setCondition('settings', { sound: true });
    runtime.fireSync('ping', 3);
    expect(action).toHaveBeenCalledExactlyOnceWith('alice');
  });

  it('omitting conditions config keeps the v0.9 behaviour', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    createTrigger<Schema>(
      {
        id: 't5',
        events: ['ping'],
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('t5', 'greet', action);
    runtime.registerCondition('t5', 'user', () => ({ id: 'manual' }));

    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledExactlyOnceWith('manual');
  });

  it('setCondition on a key not declared in config — no-op + DEV warn-once', () => {
    const runtime = createRuntime();
    const t = createTrigger<Schema>(
      {
        id: 't6',
        events: ['ping'],
        conditions: { user: null },
        handler() {},
      },
      runtime,
    );

    // 'settings' wasn't declared — should be ignored, warn fires once
    t.setCondition('settings', { sound: true });
    t.setCondition('settings', { sound: false });
    const undeclaredCalls = warn.mock.calls.filter((args: unknown[]) =>
      String(args[0] ?? '').includes('not declared'),
    );
    expect(undeclaredCalls).toHaveLength(1);
  });

  it('setCondition on a disposed trigger — no-op + DEV warn-once', () => {
    const runtime = createRuntime();
    const t = createTrigger<Schema>(
      {
        id: 't7',
        events: ['ping'],
        conditions: { user: null },
        handler() {},
      },
      runtime,
    );
    t.dispose();
    t.setCondition('user', { id: 'x' });
    t.setCondition('user', { id: 'y' });
    const disposedCalls = warn.mock.calls.filter((args: unknown[]) =>
      String(args[0] ?? '').includes('disposed trigger'),
    );
    expect(disposedCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('inline conditions respect the trigger scope', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 't8',
        events: ['ping'],
        scope: 'panel-1',
        conditions: { user: { id: 'scoped' }, settings: { sound: true } },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('t8', 'greet', action, { scope: 'panel-1' });

    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledExactlyOnceWith('scoped');

    t.setCondition('user', { id: 'rescoped' });
    runtime.fireSync('ping', 2);
    expect(action).toHaveBeenLastCalledWith('rescoped');
  });

  it('setCondition can be called before the first dispatch — value is applied', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 't9',
        events: ['ping'],
        conditions: { user: null },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('t9', 'greet', action);

    // Set before any fire — should be picked up on the first fire.
    t.setCondition('user', { id: 'early' });
    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledExactlyOnceWith('early');
  });

  it('multiple triggers — setCondition is isolated per trigger', () => {
    const runtime = createRuntime();
    const aAction = vi.fn();
    const bAction = vi.fn();
    const a = createTrigger<Schema>(
      {
        id: 'ta',
        events: ['ping'],
        conditions: { user: { id: 'a' } },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    const b = createTrigger<Schema>(
      {
        id: 'tb',
        events: ['ping'],
        conditions: { user: { id: 'b' } },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('ta', 'greet', aAction);
    runtime.registerAction('tb', 'greet', bAction);

    a.setCondition('user', { id: 'A2' });
    runtime.fireSync('ping', 1);
    expect(aAction).toHaveBeenLastCalledWith('A2');
    expect(bAction).toHaveBeenLastCalledWith('b');

    b.setCondition('user', { id: 'B2' });
    runtime.fireSync('ping', 2);
    expect(aAction).toHaveBeenLastCalledWith('A2');
    expect(bAction).toHaveBeenLastCalledWith('B2');
  });

  it('conditions config: numeric values, boolean, string all flow through', () => {
    const runtime = createRuntime();
    let captured: { n: number; b: boolean; s: string } | null = null;
    const t = createTrigger<{
      events: { go: void };
      conditions: { n: number; b: boolean; s: string };
    }>(
      {
        id: 'tn',
        events: ['go'],
        conditions: { n: 0, b: false, s: 'init' },
        required: ['n', 'b', 's'],
        handler({ conditions }) {
          if (typeof conditions.n !== 'number') return;
          if (typeof conditions.b !== 'boolean') return;
          if (typeof conditions.s !== 'string') return;
          captured = { n: conditions.n, b: conditions.b, s: conditions.s };
        },
      },
      runtime,
    );

    runtime.fireSync('go');
    expect(captured).toEqual({ n: 0, b: false, s: 'init' });

    t.setCondition('n', 42);
    t.setCondition('b', true);
    t.setCondition('s', 'updated');
    runtime.fireSync('go');
    expect(captured).toEqual({ n: 42, b: true, s: 'updated' });
  });

  it('inline conditions are unregistered when the trigger is disposed', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'td',
        events: ['ping'],
        conditions: { user: { id: 'alice' } },
        required: ['user'],
        handler({ conditions, actions }) {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    runtime.registerAction('td', 'greet', action);
    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledOnce();

    t.dispose();
    runtime.fireSync('ping', 2);
    expect(action).toHaveBeenCalledOnce(); // not called again
  });
});
