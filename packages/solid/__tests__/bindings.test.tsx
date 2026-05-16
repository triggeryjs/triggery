/** @jsxImportSource solid-js */
import { cleanup, render } from '@solidjs/testing-library';
import { createRuntime, createTrigger } from '@triggery/core';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TriggerRuntimeProvider,
  TriggerScope,
  useAction,
  useCondition,
  useEvent,
} from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type Settings = { sound: boolean; theme: 'light' | 'dark' };

type Schema = {
  events: { tick: number; reset: void };
  conditions: { settings: Settings };
  actions: { record: { kind: 'tick' | 'reset'; payload?: unknown } };
};

function setupTrigger() {
  const runtime = createRuntime();
  const fired: { kind: string; payload?: unknown }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'solid-bindings',
      events: ['tick', 'reset'],
      required: ['settings'],
      handler({ event, conditions, actions }) {
        if (!conditions.settings) return;
        if (event.name === 'tick') actions.record?.({ kind: 'tick', payload: event.payload });
        if (event.name === 'reset') actions.record?.({ kind: 'reset' });
      },
    },
    runtime,
  );
  runtime.registerAction('solid-bindings', 'record', (p) => {
    fired.push(p as { kind: string; payload?: unknown });
  });
  return { runtime, trigger, fired };
}

describe('@triggery/solid', () => {
  it('useEvent returns a function that fires the event (via microtask scheduler)', async () => {
    const { runtime, trigger, fired } = setupTrigger();

    function Tester() {
      useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
      const fire = useEvent(trigger, 'tick');
      fire(7);
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Tester />
      </TriggerRuntimeProvider>
    ));

    // Default scheduler is `microtask` — flush the queue before asserting.
    await Promise.resolve();
    expect(fired).toEqual([{ kind: 'tick', payload: 7 }]);
  });

  it('useCondition reads the latest signal value at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const [settings, setSettings] = createSignal<Settings>({ sound: true, theme: 'light' });

    function Provider() {
      useCondition(trigger, 'settings', () => settings());
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Provider />
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('tick', 1);
    expect(fired).toEqual([{ kind: 'tick', payload: 1 }]);

    setSettings({ sound: false, theme: 'dark' });
    runtime.fireSync('tick', 2);
    expect(fired).toEqual([
      { kind: 'tick', payload: 1 },
      { kind: 'tick', payload: 2 },
    ]);
  });

  it('useAction registers a handler that runs when the trigger body invokes it', () => {
    const { runtime, trigger } = setupTrigger();
    const calls: number[] = [];

    function Slot() {
      useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
      useAction(trigger, 'record', (p) => {
        if ((p as { kind: string }).kind === 'tick') calls.push(p.payload as number);
      });
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Slot />
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('tick', 100);
    // First action registered in the trigger setup wins; later registrations
    // override it (last-mount-wins). So `calls` records the new handler.
    expect(calls).toEqual([100]);
  });

  it('unregisters everything when the component is removed', () => {
    const { runtime, trigger, fired } = setupTrigger();

    function Provider() {
      useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
      return null;
    }

    const { unmount } = render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Provider />
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('tick', 1);
    expect(fired).toHaveLength(1);

    unmount();
    runtime.fireSync('tick', 2);
    // After unmount the required condition is gone, handler skipped.
    expect(fired).toHaveLength(1);
  });

  it('scope context is inherited via <TriggerScope>', () => {
    const runtime = createRuntime();
    const fired: number[] = [];
    const scopedTrigger = createTrigger<{
      events: { tick: number };
      conditions: { v: number };
      actions: { record: number };
    }>(
      {
        id: 'scoped',
        scope: 'chat',
        events: ['tick'],
        required: ['v'],
        handler({ event, conditions, actions }) {
          if (conditions.v === undefined) return;
          actions.record?.(event.payload + conditions.v);
        },
      },
      runtime,
    );

    function Provider() {
      useCondition(scopedTrigger, 'v', () => 10);
      useAction(scopedTrigger, 'record', (n) => {
        fired.push(n as number);
      });
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <TriggerScope id="chat">
          <Provider />
        </TriggerScope>
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('tick', 5);
    expect(fired).toEqual([15]);
  });

  it('throws a helpful error when used outside <TriggerRuntimeProvider>', () => {
    function Bad() {
      useEvent({ id: 'x' } as never, 'tick' as never);
      return null;
    }

    expect(() => render(() => <Bad />)).toThrowError(/TriggerRuntimeProvider/);
  });
});
