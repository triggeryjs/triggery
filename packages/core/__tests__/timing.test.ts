import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type Schema = {
  events: { tick: number | string };
  actions: { log: number | string };
};

describe('actions.debounce(ms)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls and fires once with the latest payload', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'debounce-coalesce',
        events: ['tick'],
        handler: ({ event, actions }) => actions.debounce(100).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('debounce-coalesce', 'log', log);

    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    expect(log).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(log).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(log).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('resets the timer on every new call', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'debounce-reset',
        events: ['tick'],
        handler: ({ event, actions }) => actions.debounce(100).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('debounce-reset', 'log', log);

    runtime.fireSync('tick', 'a');
    vi.advanceTimersByTime(60);
    runtime.fireSync('tick', 'b');
    vi.advanceTimersByTime(60);
    expect(log).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40);
    expect(log).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('disposing the trigger cancels pending debounced calls', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    const trigger = createTrigger<Schema>(
      {
        id: 'debounce-dispose',
        events: ['tick'],
        handler: ({ event, actions }) => actions.debounce(100).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('debounce-dispose', 'log', log);
    runtime.fireSync('tick', 1);
    trigger.dispose();
    vi.advanceTimersByTime(200);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('actions.throttle(ms)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leading edge: fires immediately, drops calls within the window', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'throttle-leading',
        events: ['tick'],
        handler: ({ event, actions }) => actions.throttle(100).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('throttle-leading', 'log', log);

    runtime.fireSync('tick', 1);
    expect(log).toHaveBeenCalledExactlyOnceWith(1);

    vi.advanceTimersByTime(50);
    runtime.fireSync('tick', 2);
    expect(log).toHaveBeenCalledTimes(1); // dropped

    vi.advanceTimersByTime(60);
    runtime.fireSync('tick', 3);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenLastCalledWith(3);
  });
});

describe('actions.defer(ms)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('each call schedules its own delivery (additive, not coalesced)', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'defer-additive',
        events: ['tick'],
        handler: ({ event, actions }) => actions.defer(50).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('defer-additive', 'log', log);

    runtime.fireSync('tick', 'a');
    runtime.fireSync('tick', 'b');
    runtime.fireSync('tick', 'c');
    expect(log).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls.map((call) => call[0])).toEqual(['a', 'b', 'c']);
  });

  it('disposing the trigger cancels pending defers', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    const trigger = createTrigger<Schema>(
      {
        id: 'defer-dispose',
        events: ['tick'],
        handler: ({ event, actions }) => actions.defer(100).log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('defer-dispose', 'log', log);
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    trigger.dispose();
    vi.advanceTimersByTime(200);
    expect(log).not.toHaveBeenCalled();
  });
});
