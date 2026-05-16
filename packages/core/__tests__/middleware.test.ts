import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger, type Middleware } from '../src/index.ts';

describe('middleware chain', () => {
  it('onFire / onActionStart / onActionEnd are called in order', () => {
    const calls: string[] = [];
    const mw: Middleware = {
      name: 'tracer',
      onFire: (c) => {
        calls.push(`fire:${c.eventName}`);
      },
      onActionStart: (c) => {
        calls.push(`start:${c.actionName}`);
      },
      onActionEnd: (c) => {
        calls.push(`end:${c.actionName}`);
      },
    };
    const runtime = createRuntime({ middleware: [mw] });
    createTrigger<{ events: { go: void }; actions: { run: void } }>(
      {
        id: 'mw-order',
        events: ['go'],
        handler: ({ actions }) => actions.run?.(),
      },
      runtime,
    );
    runtime.registerAction('mw-order', 'run', () => {});
    runtime.fireSync('go');
    expect(calls).toEqual(['fire:go', 'start:run', 'end:run']);
  });

  it('onFire cancel: { cancel: true, reason } blocks dispatch', () => {
    const handler = vi.fn();
    const mw: Middleware = {
      name: 'blocker',
      onFire: () => ({ cancel: true, reason: 'manual-cancel' }),
    };
    const runtime = createRuntime({ middleware: [mw] });
    createTrigger<{ events: { go: void }; actions: { run: void } }>(
      {
        id: 'blocked',
        events: ['go'],
        handler: ({ actions }) => actions.run?.(),
      },
      runtime,
    );
    runtime.registerAction('blocked', 'run', handler);
    runtime.fireSync('go');
    expect(handler).not.toHaveBeenCalled();
  });

  it('onSkip is called when a required condition is missing', () => {
    const onSkip = vi.fn();
    const runtime = createRuntime({ middleware: [{ name: 'skip-spy', onSkip }] });
    createTrigger<{
      events: { go: void };
      conditions: { user: { id: string } };
    }>(
      {
        id: 'skip-me',
        events: ['go'],
        required: ['user'],
        handler() {},
      },
      runtime,
    );
    runtime.fireSync('go');
    expect(onSkip).toHaveBeenCalledExactlyOnceWith({
      triggerId: 'skip-me',
      eventName: 'go',
      reason: 'missing-required-condition:user',
    });
  });

  it('onError captures sync errors thrown inside an action handler', () => {
    const onError = vi.fn();
    const runtime = createRuntime({ middleware: [{ name: 'err-spy', onError }] });
    createTrigger<{ events: { go: void }; actions: { boom: void } }>(
      {
        id: 'err',
        events: ['go'],
        handler: ({ actions }) => actions.boom?.(),
      },
      runtime,
    );
    runtime.registerAction('err', 'boom', () => {
      throw new Error('kaboom');
    });
    runtime.fireSync('go');
    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0]?.[0];
    expect(call?.actionName).toBe('boom');
    expect((call?.error as Error)?.message).toBe('kaboom');
  });
});
