import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { act, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type SocketIoLike, useSocketIoEvent } from '../src/useSocketIoEvent.ts';

afterEach(() => {
  cleanup();
});

function createFakeSocket(): SocketIoLike & {
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
} {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on(eventName, listener) {
      let set = listeners.get(eventName);
      if (!set) {
        set = new Set();
        listeners.set(eventName, set);
      }
      set.add(listener);
    },
    off(eventName, listener) {
      listeners.get(eventName)?.delete(listener);
    },
    emit(eventName, ...args) {
      const set = listeners.get(eventName);
      if (!set) return;
      for (const l of set) l(...args);
    },
    listenerCount(eventName) {
      return listeners.get(eventName)?.size ?? 0;
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
      id: 'sio-test',
      events: ['new-message'],
      handler: ({ event, actions }) => actions.record?.(event.payload),
    },
    runtime,
  );
  runtime.registerAction('sio-test', 'record', (payload) => {
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

describe('@triggery/socket — useSocketIoEvent', () => {
  it('forwards socket.io emissions into the trigger', async () => {
    const { runtime, trigger, fired } = setup();
    const socket = createFakeSocket();

    function Bridge() {
      useSocketIoEvent(trigger, 'new-message', socket, 'message');
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    await act(async () => {
      socket.emit('message', { from: 'alice', text: 'hi' });
      await Promise.resolve();
    });
    expect(fired).toEqual([{ from: 'alice', text: 'hi' }]);
  });

  it('uses mapPayload when provided (variadic args supported)', async () => {
    const { runtime, trigger, fired } = setup();
    const socket = createFakeSocket();

    function Bridge() {
      useSocketIoEvent(trigger, 'new-message', socket, 'msg', {
        mapPayload: (from, text) => ({ from: from as string, text: text as string }),
      });
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    await act(async () => {
      socket.emit('msg', 'bob', 'hi');
      await Promise.resolve();
    });
    expect(fired).toEqual([{ from: 'bob', text: 'hi' }]);
  });

  it('detaches the listener on unmount', async () => {
    const { runtime, trigger, fired } = setup();
    const socket = createFakeSocket();

    function Bridge() {
      useSocketIoEvent(trigger, 'new-message', socket, 'message');
      return null;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    await act(async () => {
      socket.emit('message', { from: 'a', text: 'x' });
      await Promise.resolve();
    });
    expect(fired).toHaveLength(1);
    expect(socket.listenerCount('message')).toBe(1);

    unmount();
    expect(socket.listenerCount('message')).toBe(0);

    await act(async () => {
      socket.emit('message', { from: 'b', text: 'y' });
      await Promise.resolve();
    });
    expect(fired).toHaveLength(1);
  });

  it('is a no-op when socket is null', () => {
    const { runtime, trigger } = setup();

    function Bridge() {
      useSocketIoEvent(trigger, 'new-message', null, 'message');
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
