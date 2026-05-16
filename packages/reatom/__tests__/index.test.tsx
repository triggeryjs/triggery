import { atom } from '@reatom/core';
import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useReatomCondition } from '../src/index.ts';

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
      id: 'reatom-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('reatom-test', 'record', (payload) => {
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

describe('@triggery/reatom', () => {
  it('reads the atom value at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const $settings = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useReatomCondition(trigger, 'settings', $settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    $settings.set({ sound: false, theme: 'dark' });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('supports a selector', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const $wrapped = atom<{ settings: Settings; n: number }>({
      settings: { sound: true, theme: 'light' },
      n: 0,
    });

    function Bridge() {
      useReatomCondition(trigger, 'settings', $wrapped, (w) => w.settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'light' });

    $wrapped.set({ settings: { sound: false, theme: 'dark' }, n: 1 });
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });

  it('does not subscribe the host (no re-renders on atom updates)', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const $settings = atom<Settings>({ sound: true, theme: 'light' });
    let renderCount = 0;

    function Bridge() {
      renderCount++;
      useReatomCondition(trigger, 'settings', $settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    const before = renderCount;
    $settings.set({ sound: false, theme: 'dark' });
    $settings.set({ sound: true, theme: 'light' });
    expect(renderCount).toBe(before);

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const $settings = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useReatomCondition(trigger, 'settings', $settings);
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
    const $settings = atom<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useReatomCondition(trigger, 'settings', $settings);
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
