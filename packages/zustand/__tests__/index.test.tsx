import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import { useZustandCondition } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type Schema = {
  events: { tick: void };
  conditions: { settings: { sound: boolean; theme: 'light' | 'dark' } };
  actions: { record: { sound: boolean; theme: 'light' | 'dark' } };
};

type Settings = { sound: boolean; theme: 'light' | 'dark' };

function setupTrigger() {
  const runtime = createRuntime();
  const fired: Settings[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'zustand-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('zustand-test', 'record', (payload) => {
    fired.push(payload as Settings);
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

describe('@triggery/zustand', () => {
  it('registers a condition that reads the current store snapshot at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore<Settings>(() => ({ sound: true, theme: 'light' }));

    function Bridge() {
      useZustandCondition(trigger, 'settings', store, (s) => s);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    store.setState({ sound: false, theme: 'dark' });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('applies the selector on each fire (pull-only, no caching)', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore<Settings>(() => ({ sound: true, theme: 'light' }));

    function Bridge() {
      useZustandCondition(trigger, 'settings', store, (s) => ({ ...s, theme: 'dark' as const }));
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'dark' });

    store.setState({ sound: false, theme: 'light' });
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });

  it('unregisters the condition on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore<Settings>(() => ({ sound: true, theme: 'light' }));

    function Bridge() {
      useZustandCondition(trigger, 'settings', store, (s) => s);
      return null;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);

    unmount();
    runtime.fireSync('tick');
    // After unmount the required condition is gone, so the handler is skipped.
    expect(fired).toHaveLength(1);
  });

  it('survives StrictMode double-mount (idempotent registration)', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore<Settings>(() => ({ sound: true, theme: 'light' }));

    function Bridge() {
      useZustandCondition(trigger, 'settings', store, (s) => s);
      return null;
    }

    render(
      <StrictMode>
        <Wrapper runtime={runtime}>
          <Bridge />
        </Wrapper>
      </StrictMode>,
    );

    runtime.fireSync('tick');
    // One fire, one record — the double-mount must not produce duplicates.
    expect(fired).toHaveLength(1);
  });

  it('swaps store across renders cleanly', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const storeA = createStore<Settings>(() => ({ sound: true, theme: 'light' }));
    const storeB = createStore<Settings>(() => ({ sound: false, theme: 'dark' }));

    function Bridge({ which }: { which: 'a' | 'b' }) {
      useZustandCondition(trigger, 'settings', which === 'a' ? storeA : storeB, (s) => s);
      return null;
    }

    const { rerender } = render(
      <Wrapper runtime={runtime}>
        <Bridge which="a" />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'light' });

    rerender(
      <Wrapper runtime={runtime}>
        <Bridge which="b" />
      </Wrapper>,
    );
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });
});
