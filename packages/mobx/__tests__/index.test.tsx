import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { configure, observable, runInAction } from 'mobx';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useMobxCondition } from '../src/index.ts';

beforeAll(() => {
  configure({ enforceActions: 'never' });
});

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
      id: 'mobx-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('mobx-test', 'record', (payload) => {
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

describe('@triggery/mobx', () => {
  it('reads the observable value at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const state = observable<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useMobxCondition(trigger, 'settings', () => ({ sound: state.sound, theme: state.theme }));
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    runInAction(() => {
      state.sound = false;
      state.theme = 'dark';
    });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('does not engage MobX dependency tracking on the host (no reaction setup)', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const state = observable<Settings>({ sound: true, theme: 'light' });
    let renderCount = 0;

    function Bridge() {
      renderCount++;
      useMobxCondition(trigger, 'settings', () => ({ sound: state.sound, theme: state.theme }));
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    const before = renderCount;
    runInAction(() => {
      state.sound = false;
    });
    runInAction(() => {
      state.sound = true;
    });
    expect(renderCount).toBe(before);

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const state = observable<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useMobxCondition(trigger, 'settings', () => ({ sound: state.sound, theme: state.theme }));
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
    const state = observable<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useMobxCondition(trigger, 'settings', () => ({ sound: state.sound, theme: state.theme }));
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
