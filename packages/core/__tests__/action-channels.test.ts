import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type Schema = {
  events: { tick: number };
  actions: { log: number; sideEffect: void };
};

const setup = () => {
  const runtime = createRuntime();
  const t = createTrigger<Schema>(
    {
      id: 'demo',
      events: ['tick'],
      handler({ event, actions }) {
        actions.log?.(event.payload);
      },
    },
    runtime,
  );
  return { runtime, t };
};

describe('B2 — action channels', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('emits to a single subscriber on fire', () => {
    const { runtime, t } = setup();
    const cb = vi.fn();
    t.action('log').subscribe(cb);

    runtime.fireSync('tick', 42);
    expect(cb).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('fan-out to multiple subscribers', () => {
    const { runtime, t } = setup();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    t.action('log').subscribe(cb1);
    t.action('log').subscribe(cb2);
    t.action('log').subscribe(cb3);

    runtime.fireSync('tick', 7);
    expect(cb1).toHaveBeenCalledExactlyOnceWith(7);
    expect(cb2).toHaveBeenCalledExactlyOnceWith(7);
    expect(cb3).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('unsubscribe stops one without affecting others', () => {
    const { runtime, t } = setup();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = t.action('log').subscribe(cb1);
    t.action('log').subscribe(cb2);

    runtime.fireSync('tick', 1);
    expect(cb1).toHaveBeenCalledExactlyOnceWith(1);
    expect(cb2).toHaveBeenCalledExactlyOnceWith(1);

    unsub1();
    runtime.fireSync('tick', 2);
    expect(cb1).toHaveBeenCalledOnce(); // unchanged
    expect(cb2).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenLastCalledWith(2);
  });

  it('channel is cached per (trigger, name)', () => {
    const { t } = setup();
    expect(t.action('log')).toBe(t.action('log'));
  });

  it('subscribed count reflects active subscriptions', () => {
    const { t } = setup();
    const channel = t.action('log');
    expect(channel.subscribed).toBe(0);

    const unsubA = channel.subscribe(() => {});
    const unsubB = channel.subscribe(() => {});
    expect(channel.subscribed).toBe(2);

    unsubA();
    expect(channel.subscribed).toBe(1);

    unsubB();
    expect(channel.subscribed).toBe(0);
  });

  it('works alongside runtime.registerAction (both invoked)', () => {
    const { runtime, t } = setup();
    const channelCb = vi.fn();
    const registeredCb = vi.fn();
    t.action('log').subscribe(channelCb);
    runtime.registerAction('demo', 'log', registeredCb);

    runtime.fireSync('tick', 9);
    expect(channelCb).toHaveBeenCalledExactlyOnceWith(9);
    expect(registeredCb).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('dispose() clears subscribers and rejects further subscribes', () => {
    const { runtime, t } = setup();
    const before = vi.fn();
    t.action('log').subscribe(before);

    t.dispose();

    const after = vi.fn();
    const unsub = t.action('log').subscribe(after);
    expect(typeof unsub).toBe('function');

    runtime.fireSync('tick', 1);
    expect(before).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it('handles a void-payload action (Sound type)', () => {
    const runtime = createRuntime();
    const cb = vi.fn();
    const t = createTrigger<{
      events: { go: void };
      actions: { sideEffect: void };
    }>(
      {
        id: 'void-demo',
        events: ['go'],
        handler({ actions }) {
          actions.sideEffect?.();
        },
      },
      runtime,
    );
    t.action('sideEffect').subscribe(cb);

    runtime.fireSync('go');
    expect(cb).toHaveBeenCalledOnce();
  });

  it("subscribers do not see one another's callbacks after subscribe", () => {
    const { runtime, t } = setup();
    const order: string[] = [];
    t.action('log').subscribe((n) => order.push(`a:${n}`));
    t.action('log').subscribe((n) => order.push(`b:${n}`));
    t.action('log').subscribe((n) => order.push(`c:${n}`));

    runtime.fireSync('tick', 3);
    expect(order).toEqual(['a:3', 'b:3', 'c:3']);
  });

  it('StrictMode-like double-subscribe + unsubscribe leaves no leak', () => {
    const { runtime, t } = setup();
    const cb = vi.fn();

    // Simulate StrictMode mount → cleanup → mount
    const unsub1 = t.action('log').subscribe(cb);
    unsub1();
    const unsub2 = t.action('log').subscribe(cb);

    runtime.fireSync('tick', 1);
    expect(cb).toHaveBeenCalledExactlyOnceWith(1);

    unsub2();
    runtime.fireSync('tick', 2);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('respects scope on the underlying runtime.registerAction', () => {
    const runtime = createRuntime();
    const cb = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'scoped',
        events: ['tick'],
        scope: 'panel-1',
        handler({ event, actions }) {
          actions.log?.(event.payload);
        },
      },
      runtime,
    );
    t.action('log').subscribe(cb);

    runtime.fireSync('tick', 1);
    expect(cb).toHaveBeenCalledExactlyOnceWith(1);
  });
});
