import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { act, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useWebSocketEvent, type WebSocketLike } from '../src/useWebSocketEvent.ts';

afterEach(() => {
  cleanup();
});

function createFakeWebSocket(): WebSocketLike & {
  dispatch(type: string, event: Event): void;
  listenerCount(type: string): number;
} {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event) {
      const set = listeners.get(type);
      if (!set) return;
      for (const l of set) l(event);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

type Schema = {
  events: { 'new-message': { from: string; text: string } };
  actions: { record: { from: string; text: string } };
};

function setup() {
  const runtime = createRuntime();
  const fired: { from: string; text: string }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'ws-test',
      events: ['new-message'],
      handler: ({ event, actions }) => actions.record?.(event.payload),
    },
    runtime,
  );
  runtime.registerAction('ws-test', 'record', (payload) => {
    fired.push(payload as { from: string; text: string });
  });
  return { runtime, trigger, fired };
}

function Wrapper({
  runtime,
  children,
}: {
  runtime: ReturnType<typeof createRuntime>;
  children: ReactNode;
}) {
  return <TriggerRuntimeProvider runtime={runtime}>{children}</TriggerRuntimeProvider>;
}

describe('@triggery/socket — useWebSocketEvent', () => {
  it('forwards WebSocket messages with the supplied mapPayload', async () => {
    const { runtime, trigger, fired } = setup();
    const ws = createFakeWebSocket();

    function Bridge() {
      useWebSocketEvent(trigger, 'new-message', ws, 'message', {
        mapPayload: (e) => JSON.parse((e as MessageEvent).data),
      });
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    await act(async () => {
      ws.dispatch(
        'message',
        new MessageEvent('message', { data: JSON.stringify({ from: 'a', text: 'x' }) }),
      );
      await Promise.resolve();
    });
    expect(fired).toEqual([{ from: 'a', text: 'x' }]);
  });

  it('detaches on unmount', async () => {
    const { runtime, trigger, fired } = setup();
    const ws = createFakeWebSocket();

    function Bridge() {
      useWebSocketEvent(trigger, 'new-message', ws, 'message', {
        mapPayload: (e) => JSON.parse((e as MessageEvent).data),
      });
      return null;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    await act(async () => {
      ws.dispatch(
        'message',
        new MessageEvent('message', { data: JSON.stringify({ from: 'a', text: 'x' }) }),
      );
      await Promise.resolve();
    });
    expect(fired).toHaveLength(1);
    expect(ws.listenerCount('message')).toBe(1);

    unmount();
    expect(ws.listenerCount('message')).toBe(0);
  });

  it('is a no-op when ws is null', () => {
    const { runtime, trigger } = setup();

    function Bridge() {
      useWebSocketEvent(trigger, 'new-message', null, 'message');
      return null;
    }

    expect(() =>
      render(
        <Wrapper runtime={runtime}>
          <Bridge />
        </Wrapper>,
      ),
    ).not.toThrow();
  });
});
