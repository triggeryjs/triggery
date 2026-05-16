import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { act, type ReactNode, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDomEvent } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type Schema = {
  events: { 'dom-click': MouseEvent; 'dom-key': { key: string } };
  actions: { recordClick: MouseEvent; recordKey: { key: string } };
};

function setupRuntime() {
  const runtime = createRuntime();
  const clicks: MouseEvent[] = [];
  const keys: { key: string }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'dom-event',
      events: ['dom-click', 'dom-key'],
      handler({ event, actions }) {
        if (event.name === 'dom-click') actions.recordClick?.(event.payload);
        if (event.name === 'dom-key') actions.recordKey?.(event.payload);
      },
    },
    runtime,
  );
  runtime.registerAction('dom-event', 'recordClick', (payload) => {
    clicks.push(payload as MouseEvent);
  });
  runtime.registerAction('dom-event', 'recordKey', (payload) => {
    keys.push(payload as { key: string });
  });
  return { runtime, trigger, clicks, keys };
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

describe('@triggery/dom — useDomEvent', () => {
  it('forwards events from a window-level target', async () => {
    const { runtime, trigger, clicks } = setupRuntime();

    function GlobalClicks() {
      useDomEvent(trigger, 'dom-click', window, 'click');
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <GlobalClicks />
      </Wrapper>,
    );

    await act(async () => {
      window.dispatchEvent(new MouseEvent('click'));
      await Promise.resolve();
    });
    expect(clicks).toHaveLength(1);
  });

  it('forwards events from a ref target once the ref is populated', async () => {
    const { runtime, trigger, keys } = setupRuntime();

    function Input() {
      const ref = useRef<HTMLInputElement>(null);
      useDomEvent(trigger, 'dom-key', ref, 'keydown', {
        mapPayload: (e) => ({ key: (e as KeyboardEvent).key }),
      });
      return <input ref={ref} data-testid="i" />;
    }

    const { getByTestId } = render(
      <Wrapper runtime={runtime}>
        <Input />
      </Wrapper>,
    );

    const el = getByTestId('i') as HTMLInputElement;
    await act(async () => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await Promise.resolve();
    });
    expect(keys).toEqual([{ key: 'Enter' }]);
  });

  it('detaches the listener on unmount', async () => {
    const { runtime, trigger, clicks } = setupRuntime();

    function GlobalClicks() {
      useDomEvent(trigger, 'dom-click', window, 'click');
      return null;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <GlobalClicks />
      </Wrapper>,
    );

    await act(async () => {
      window.dispatchEvent(new MouseEvent('click'));
      await Promise.resolve();
    });
    const before = clicks.length;

    unmount();
    await act(async () => {
      window.dispatchEvent(new MouseEvent('click'));
      window.dispatchEvent(new MouseEvent('click'));
      await Promise.resolve();
    });
    expect(clicks.length).toBe(before);
  });

  it('skips attachment when the target is null/undefined', () => {
    const { runtime, trigger } = setupRuntime();

    function Detached() {
      useDomEvent(trigger, 'dom-click', null, 'click');
      return null;
    }

    expect(() =>
      render(
        <Wrapper runtime={runtime}>
          <Detached />
        </Wrapper>,
      ),
    ).not.toThrow();
  });
});
