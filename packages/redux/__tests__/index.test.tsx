import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, StrictMode } from 'react';
import { createStore } from 'redux';
import { afterEach, describe, expect, it } from 'vitest';
import { useReduxCondition } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type Settings = { sound: boolean; theme: 'light' | 'dark' };
type State = { settings: Settings; counter: number };

type Schema = {
  events: { tick: void };
  conditions: { settings: Settings };
  actions: { record: Settings };
};

type Action = { type: 'SET_SETTINGS'; payload: Settings } | { type: 'INC' } | { type: '@@INIT' };

function reducer(
  state: State = { settings: { sound: true, theme: 'light' }, counter: 0 },
  action: Action,
): State {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'INC':
      return { ...state, counter: state.counter + 1 };
    default:
      return state;
  }
}

function setupTrigger() {
  const runtime = createRuntime();
  const fired: Settings[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'redux-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('redux-test', 'record', (payload) => {
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

describe('@triggery/redux', () => {
  it('reads the current store slice at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore(reducer);

    function Bridge() {
      useReduxCondition(trigger, 'settings', store, (s) => s.settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    store.dispatch({ type: 'SET_SETTINGS', payload: { sound: false, theme: 'dark' } });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('does not re-render the host component on unrelated dispatches', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore(reducer);
    let renderCount = 0;

    function Bridge() {
      renderCount++;
      useReduxCondition(trigger, 'settings', store, (s) => s.settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    const before = renderCount;
    store.dispatch({ type: 'INC' });
    store.dispatch({ type: 'INC' });
    store.dispatch({ type: 'INC' });
    expect(renderCount).toBe(before);

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const store = createStore(reducer);

    function Bridge() {
      useReduxCondition(trigger, 'settings', store, (s) => s.settings);
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
    const store = createStore(reducer);

    function Bridge() {
      useReduxCondition(trigger, 'settings', store, (s) => s.settings);
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
