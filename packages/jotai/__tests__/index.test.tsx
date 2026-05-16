import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { atom, createStore } from 'jotai';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useJotaiCondition } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type Settings = { sound: boolean; theme: 'light' | 'dark' };

type Schema = {
  events: { tick: void };
  conditions: { settings: Settings };
  actions: { record: Settings };
};

function setupTrigger() {
  const runtime = createRuntime();
  const fired: Settings[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'jotai-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('jotai-test', 'record', (payload) => {
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

describe('@triggery/jotai', () => {
  it('reads the atom value at fire time via the provided store', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore();
    const settingsAtom = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useJotaiCondition(trigger, 'settings', store, settingsAtom);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    store.set(settingsAtom, { sound: false, theme: 'dark' });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('supports a selector for atom projections', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore();
    const wrapped = atom<{ settings: Settings; meta: number }>({
      settings: { sound: true, theme: 'light' },
      meta: 0,
    });

    function Bridge() {
      useJotaiCondition(trigger, 'settings', store, wrapped, (v) => v.settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'light' });

    store.set(wrapped, { settings: { sound: false, theme: 'dark' }, meta: 1 });
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore();
    const settingsAtom = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useJotaiCondition(trigger, 'settings', store, settingsAtom);
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
    expect(fired).toHaveLength(1);
  });

  it('survives StrictMode double-mount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore();
    const settingsAtom = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useJotaiCondition(trigger, 'settings', store, settingsAtom);
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
    expect(fired).toHaveLength(1);
  });
});
