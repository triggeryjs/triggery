import { createRuntime, createTrigger } from '@triggery/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reduxDevtoolsMiddleware } from '../src/index.ts';

type ConnMock = {
  init: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

let conn: ConnMock;

function installFakeExtension(): void {
  conn = {
    init: vi.fn(),
    send: vi.fn(),
    unsubscribe: vi.fn(),
  };
  const connect = vi.fn().mockReturnValue(conn);
  vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', { connect });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reduxDevtoolsMiddleware — without an extension', () => {
  it('returns a no-op middleware with no hooks', () => {
    const mw = reduxDevtoolsMiddleware();
    expect(mw.name).toBe('devtools-redux');
    expect(mw.onFire).toBeUndefined();
    expect(mw.onActionStart).toBeUndefined();
  });
});

describe('reduxDevtoolsMiddleware — with extension installed', () => {
  beforeEach(() => {
    installFakeExtension();
  });

  it('calls connect + init on creation', () => {
    reduxDevtoolsMiddleware({ name: 'Demo' });
    expect(conn.init).toHaveBeenCalledExactlyOnceWith({ history: [] });
  });

  it('sends a triggery/fire entry when an event is dispatched', () => {
    const runtime = createRuntime({ middleware: [reduxDevtoolsMiddleware()] });
    createTrigger<{ events: { tick: number } }>(
      { id: 'demo', events: ['tick'], handler() {} },
      runtime,
    );
    runtime.fireSync('tick', 42);

    const firstSend = conn.send.mock.calls.find((call) =>
      String(call[0]?.type ?? '').startsWith('triggery/fire'),
    );
    expect(firstSend?.[0]).toEqual({ type: 'triggery/fire:tick' });
    const state = firstSend?.[1] as { history: { eventName: string; payload: unknown }[] };
    const fireEntry = state.history.find((h) => h.eventName === 'tick');
    expect(fireEntry?.payload).toBe(42);
  });

  it('records action-start, action-end and error entries', () => {
    const runtime = createRuntime({ middleware: [reduxDevtoolsMiddleware()] });
    createTrigger<{ events: { go: void }; actions: { run: void; boom: void } }>(
      {
        id: 't',
        events: ['go'],
        handler: ({ actions }) => {
          actions.run?.();
          actions.boom?.();
        },
      },
      runtime,
    );
    runtime.registerAction('t', 'run', () => {});
    runtime.registerAction('t', 'boom', () => {
      throw new Error('bad');
    });
    const restore = vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime.fireSync('go');
    restore.mockRestore();

    const types = conn.send.mock.calls.map((call) => String(call[0]?.type ?? ''));
    expect(types).toContain('triggery/action-start:t.run');
    expect(types).toContain('triggery/action-end:t.run');
    expect(types).toContain('triggery/action-start:t.boom');
    expect(types).toContain('triggery/error:t.boom');
  });

  it('records skip entries with the reason in the action type', () => {
    const runtime = createRuntime({ middleware: [reduxDevtoolsMiddleware()] });
    createTrigger<{ events: { go: void }; conditions: { user: { id: string } } }>(
      {
        id: 'gated',
        events: ['go'],
        required: ['user'],
        handler() {},
      },
      runtime,
    );
    runtime.fireSync('go');
    const types = conn.send.mock.calls.map((call) => String(call[0]?.type ?? ''));
    expect(types).toContain('triggery/skip:gated:missing-required-condition:user');
  });

  it('records cascade overflow entries with depth + kind', () => {
    const runtime = createRuntime({
      maxCascadeDepth: 0,
      middleware: [reduxDevtoolsMiddleware()],
    });
    createTrigger<{ events: { a: void }; actions: { goB: void } }>(
      {
        id: 't-a',
        events: ['a'],
        handler: ({ actions }) => actions.goB?.(),
      },
      runtime,
    );
    createTrigger<{ events: { b: void } }>({ id: 't-b', events: ['b'], handler() {} }, runtime);
    runtime.registerAction('t-a', 'goB', () => runtime.fireSync('b'));
    runtime.fireSync('a');
    const cascadeSend = conn.send.mock.calls.find((call) =>
      String(call[0]?.type ?? '').startsWith('triggery/cascade'),
    );
    expect(cascadeSend?.[0]).toEqual({ type: 'triggery/cascade:overflow' });
  });

  it('truncates the history to the configured limit', () => {
    const runtime = createRuntime({
      middleware: [reduxDevtoolsMiddleware({ historyLimit: 3 })],
    });
    createTrigger<{ events: { tick: number } }>(
      { id: 'h', events: ['tick'], handler() {} },
      runtime,
    );
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    runtime.fireSync('tick', 4);
    runtime.fireSync('tick', 5);
    const lastSend = conn.send.mock.calls.at(-1);
    const state = lastSend?.[1] as { history: { payload: number }[] };
    expect(state.history).toHaveLength(3);
    expect(state.history.map((h) => h.payload)).toEqual([3, 4, 5]);
  });
});
