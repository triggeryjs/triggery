import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { act, type ReactNode, useRef } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useResizeObserver } from '../src/useResizeObserver.ts';

afterEach(() => {
  cleanup();
});

// happy-dom doesn't ship a ResizeObserver implementation — install a minimal
// one that lets tests trigger callbacks manually.
type Callback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

const registry = new Set<{ cb: Callback; observer: ResizeObserver }>();

beforeAll(() => {
  class FakeRO {
    constructor(private readonly cb: Callback) {}
    observe(_el: Element): void {
      registry.add({ cb: this.cb, observer: this as unknown as ResizeObserver });
    }
    unobserve(): void {}
    disconnect(): void {
      for (const entry of registry) {
        if (entry.observer === (this as unknown as ResizeObserver)) registry.delete(entry);
      }
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: install the polyfill on the test global
  (globalThis as any).ResizeObserver = FakeRO;
});

function fireResize(width: number, height: number) {
  for (const { cb, observer } of registry) {
    cb([{ contentRect: { width, height } } as unknown as ResizeObserverEntry], observer);
  }
}

type Schema = {
  events: { resized: { w: number; h: number } };
  actions: { record: { w: number; h: number } };
};

function setup() {
  const runtime = createRuntime();
  const fired: { w: number; h: number }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'resize-test',
      events: ['resized'],
      handler: ({ event, actions }) => actions.record?.(event.payload),
    },
    runtime,
  );
  runtime.registerAction('resize-test', 'record', (payload) => {
    fired.push(payload as { w: number; h: number });
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

describe('@triggery/dom — useResizeObserver', () => {
  it('fires the trigger event on every resize, with the mapped payload', async () => {
    const { runtime, trigger, fired } = setup();
    const mapPayload = vi.fn((e: ResizeObserverEntry) => ({
      w: e.contentRect.width,
      h: e.contentRect.height,
    }));

    function Panel() {
      const ref = useRef<HTMLDivElement>(null);
      useResizeObserver(trigger, 'resized', ref, { mapPayload });
      return <div ref={ref} />;
    }

    render(
      <Wrapper runtime={runtime}>
        <Panel />
      </Wrapper>,
    );

    await act(async () => {
      fireResize(200, 100);
      await Promise.resolve();
    });
    await act(async () => {
      fireResize(300, 150);
      await Promise.resolve();
    });
    expect(fired).toEqual([
      { w: 200, h: 100 },
      { w: 300, h: 150 },
    ]);
  });

  it('disconnects the observer on unmount', async () => {
    const { runtime, trigger, fired } = setup();
    function Panel() {
      const ref = useRef<HTMLDivElement>(null);
      useResizeObserver(trigger, 'resized', ref, {
        mapPayload: (e) => ({ w: e.contentRect.width, h: e.contentRect.height }),
      });
      return <div ref={ref} />;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Panel />
      </Wrapper>,
    );

    await act(async () => {
      fireResize(100, 100);
      await Promise.resolve();
    });
    const before = fired.length;

    unmount();
    await act(async () => {
      fireResize(200, 200);
      await Promise.resolve();
    });
    expect(fired.length).toBe(before);
  });
});
