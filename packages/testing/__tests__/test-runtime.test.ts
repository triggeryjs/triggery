import { createTrigger } from '@triggery/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestRuntime } from '../src/index.ts';

type Schema = {
  events: { tick: number };
  conditions: { enabled: boolean; threshold: number };
  actions: { log: number };
};

describe('createTestRuntime', () => {
  it('isolated runtime — triggers do not leak across test runtimes', () => {
    const rtA = createTestRuntime();
    const rtB = createTestRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'iso',
        events: ['tick'],
        handler: ({ event, actions }) => actions.log?.(event.payload),
      },
      rtA,
    );
    rtA.registerAction('iso', 'log', log);
    rtB.fireSync('tick', 1);
    expect(log).not.toHaveBeenCalled();
    rtA.fireSync('tick', 7);
    expect(log).toHaveBeenCalledExactlyOnceWith(7);
  });
});

describe('mockCondition', () => {
  it('accepts a plain value and wraps it as a getter', () => {
    const rt = createTestRuntime();
    const seen: Array<number | undefined> = [];
    const t = createTrigger<Schema>(
      {
        id: 'mock-cond-value',
        events: ['tick'],
        required: ['enabled', 'threshold'],
        handler: ({ conditions, event }) => {
          if (!conditions.enabled) return;
          if ((conditions.threshold ?? 0) > event.payload) return;
          seen.push(event.payload);
        },
      },
      rt,
    );
    rt.mockCondition(t, 'enabled', true);
    rt.mockCondition(t, 'threshold', 5);

    rt.fireSync('tick', 1);
    rt.fireSync('tick', 10);
    expect(seen).toEqual([10]);
  });

  it('accepts a zero-arg getter and uses it directly', () => {
    const rt = createTestRuntime();
    let counter = 0;
    const probe = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'mock-cond-getter',
        events: ['tick'],
        required: ['threshold'],
        handler: ({ conditions }) => probe(conditions.threshold),
      },
      rt,
    );
    rt.mockCondition(t, 'threshold', () => ++counter);

    rt.fireSync('tick', 0);
    rt.fireSync('tick', 0);
    expect(probe).toHaveBeenNthCalledWith(1, 1);
    expect(probe).toHaveBeenNthCalledWith(2, 2);
  });
});

describe('mockAction', () => {
  it('registers a handler that the trigger invokes', () => {
    const rt = createTestRuntime();
    const log = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'mock-action',
        events: ['tick'],
        handler: ({ event, actions }) => actions.log?.(event.payload),
      },
      rt,
    );
    rt.mockAction(t, 'log', log);
    rt.fireSync('tick', 42);
    expect(log).toHaveBeenCalledExactlyOnceWith(42);
  });
});

describe('flushMicrotasks', () => {
  it('drains queued microtask fires before assertions', async () => {
    const rt = createTestRuntime();
    const log = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'flush',
        events: ['tick'],
        handler: ({ event, actions }) => actions.log?.(event.payload),
      },
      rt,
    );
    rt.mockAction(t, 'log', log);
    rt.fire('tick', 1);
    rt.fire('tick', 2);
    expect(log).not.toHaveBeenCalled();

    await rt.flushMicrotasks();
    expect(log).toHaveBeenCalledTimes(2);
  });
});
