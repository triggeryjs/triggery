import { describe, expect, it, vi } from 'vitest';
import {
  createRuntime,
  createTrigger,
  getDefaultRuntime,
  setDefaultRuntime,
} from '../src/index.ts';

describe('runtime — defaults', () => {
  it('getDefaultRuntime returns a singleton; setDefaultRuntime replaces it', () => {
    const a = getDefaultRuntime();
    const b = getDefaultRuntime();
    expect(a).toBe(b);

    const replacement = createRuntime();
    setDefaultRuntime(replacement);
    expect(getDefaultRuntime()).toBe(replacement);

    // Restore to a fresh singleton for the rest of the suite (avoid cross-test leakage).
    setDefaultRuntime(createRuntime());
  });

  it('subscribe receives inspector snapshots; unregister stops the stream', () => {
    const runtime = createRuntime();
    const snapshots: { triggerId: string; status: string }[] = [];
    const sub = runtime.subscribe((s) =>
      snapshots.push({ triggerId: s.triggerId, status: s.status }),
    );
    createTrigger<{ events: { go: void } }>(
      {
        id: 'sub',
        events: ['go'],
        handler() {},
      },
      runtime,
    );
    runtime.fireSync('go');
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]?.status).toBe('fired');

    sub.unregister();
    runtime.fireSync('go');
    expect(snapshots.length).toBe(1); // no further events delivered
  });

  it('getTrigger / enable / disable / dispose round-trip', () => {
    const runtime = createRuntime();
    const handler = vi.fn();
    createTrigger<{ events: { go: void } }>(
      {
        id: 'lifecycle',
        events: ['go'],
        handler,
      },
      runtime,
    );

    const fromRuntime = runtime.getTrigger('lifecycle');
    expect(fromRuntime?.id).toBe('lifecycle');
    expect(fromRuntime?.isEnabled()).toBe(true);

    fromRuntime?.disable();
    runtime.fireSync('go');
    expect(handler).not.toHaveBeenCalled();

    fromRuntime?.enable();
    runtime.fireSync('go');
    expect(handler).toHaveBeenCalledTimes(1);

    runtime.dispose();
    runtime.fireSync('go');
    expect(handler).toHaveBeenCalledTimes(1); // dispose clears the registry
  });

  it('register* on a missing trigger returns a no-op token', () => {
    const runtime = createRuntime();
    const cond = runtime.registerCondition('ghost', 'x', () => 1);
    const act = runtime.registerAction('ghost', 'y', () => {});
    expect(() => cond.unregister()).not.toThrow();
    expect(() => act.unregister()).not.toThrow();
  });

  it('replacing a trigger with the same id deindexes the previous version', () => {
    const runtime = createRuntime();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    createTrigger<{ events: { go: void } }>(
      { id: 'replace', events: ['go'], handler: firstHandler },
      runtime,
    );
    createTrigger<{ events: { go: void } }>(
      { id: 'replace', events: ['go'], handler: secondHandler },
      runtime,
    );
    runtime.fireSync('go');
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });
});
