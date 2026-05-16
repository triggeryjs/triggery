import { signal } from '@preact/signals-core';
import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSignalCondition } from '../src/index.ts';

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
      id: 'signals-test',
      events: ['tick'],
      required: ['settings'],
      handler: ({ conditions, actions }) => {
        if (!conditions.settings) return;
        actions.record?.(conditions.settings);
      },
    },
    runtime,
  );
  runtime.registerAction('signals-test', 'record', (payload) => {
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

describe('@triggery/signals (with @preact/signals-core)', () => {
  it('reads the signal value at fire time via peek()', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const settings = signal<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useSignalCondition(trigger, 'settings', settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ sound: true, theme: 'light' }]);

    settings.value = { sound: false, theme: 'dark' };
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { sound: true, theme: 'light' },
      { sound: false, theme: 'dark' },
    ]);
  });

  it('supports a selector', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const wrapped = signal<{ settings: Settings; n: number }>({
      settings: { sound: true, theme: 'light' },
      n: 0,
    });

    function Bridge() {
      useSignalCondition(trigger, 'settings', wrapped, (w) => w.settings);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'light' });

    wrapped.value = { settings: { sound: false, theme: 'dark' }, n: 1 };
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });

  it('falls back to .value when peek is absent', () => {
    const { runtime, trigger, fired } = setupTrigger();
    // Simulate a TC39-style signal with only a getter, no peek.
    let inner: Settings = { sound: true, theme: 'light' };
    const pseudoSignal = {
      get value(): Settings {
        return inner;
      },
    };

    function Bridge() {
      useSignalCondition(trigger, 'settings', pseudoSignal);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ sound: true, theme: 'light' });

    inner = { sound: false, theme: 'dark' };
    runtime.fireSync('tick');
    expect(fired[1]).toEqual({ sound: false, theme: 'dark' });
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const settings = signal<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useSignalCondition(trigger, 'settings', settings);
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
    const settings = signal<Settings>({ sound: true, theme: 'light' });

    function Bridge() {
      useSignalCondition(trigger, 'settings', settings);
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
