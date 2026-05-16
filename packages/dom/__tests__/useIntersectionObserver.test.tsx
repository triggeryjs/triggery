import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { act, type ReactNode, useRef } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useIntersectionObserver } from '../src/useIntersectionObserver.ts';

afterEach(() => {
  cleanup();
});

// happy-dom doesn't ship IntersectionObserver — minimal polyfill.
type Cb = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;
const registry = new Set<{ cb: Cb; observer: IntersectionObserver }>();

beforeAll(() => {
  class FakeIO {
    constructor(private readonly cb: Cb) {}
    observe(_el: Element): void {
      registry.add({ cb: this.cb, observer: this as unknown as IntersectionObserver });
    }
    unobserve(): void {}
    disconnect(): void {
      for (const entry of registry) {
        if (entry.observer === (this as unknown as IntersectionObserver)) registry.delete(entry);
      }
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: install the polyfill globally
  (globalThis as any).IntersectionObserver = FakeIO;
});

function fireIntersection(isIntersecting: boolean, intersectionRatio: number) {
  for (const { cb, observer } of registry) {
    cb([{ isIntersecting, intersectionRatio } as unknown as IntersectionObserverEntry], observer);
  }
}

type Schema = {
  events: { visible: { v: boolean; r: number } };
  actions: { record: { v: boolean; r: number } };
};

function setup() {
  const runtime = createRuntime();
  const fired: { v: boolean; r: number }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'io-test',
      events: ['visible'],
      handler: ({ event, actions }) => actions.record?.(event.payload),
    },
    runtime,
  );
  runtime.registerAction('io-test', 'record', (payload) => {
    fired.push(payload as { v: boolean; r: number });
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

describe('@triggery/dom — useIntersectionObserver', () => {
  it('fires the trigger event on each intersection change', async () => {
    const { runtime, trigger, fired } = setup();

    function Item() {
      const ref = useRef<HTMLLIElement>(null);
      useIntersectionObserver(trigger, 'visible', ref, {
        mapPayload: (e) => ({ v: e.isIntersecting, r: e.intersectionRatio }),
      });
      return <li ref={ref} />;
    }

    render(
      <Wrapper runtime={runtime}>
        <Item />
      </Wrapper>,
    );

    await act(async () => {
      fireIntersection(true, 1);
      await Promise.resolve();
    });
    await act(async () => {
      fireIntersection(false, 0);
      await Promise.resolve();
    });
    expect(fired).toEqual([
      { v: true, r: 1 },
      { v: false, r: 0 },
    ]);
  });

  it('disconnects on unmount', async () => {
    const { runtime, trigger, fired } = setup();

    function Item() {
      const ref = useRef<HTMLLIElement>(null);
      useIntersectionObserver(trigger, 'visible', ref, {
        mapPayload: (e) => ({ v: e.isIntersecting, r: e.intersectionRatio }),
      });
      return <li ref={ref} />;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Item />
      </Wrapper>,
    );

    await act(async () => {
      fireIntersection(true, 1);
      await Promise.resolve();
    });
    const before = fired.length;

    unmount();
    await act(async () => {
      fireIntersection(false, 0);
      await Promise.resolve();
    });
    expect(fired.length).toBe(before);
  });
});
