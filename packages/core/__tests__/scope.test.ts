import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type Schema = {
  events: { tick: number };
  conditions: { user: { id: string } };
  actions: { log: number };
};

describe('scope — matching trigger and registration', () => {
  it('scoped trigger sees scoped registrations with the same scope', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'scoped-ok',
        scope: 'chat',
        events: ['tick'],
        required: ['user'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.user) return;
          actions.log?.(event.payload);
        },
      },
      runtime,
    );
    runtime.registerCondition('scoped-ok', 'user', () => ({ id: 'alice' }), { scope: 'chat' });
    runtime.registerAction('scoped-ok', 'log', log, { scope: 'chat' });
    runtime.fireSync('tick', 7);
    expect(log).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('global trigger sees global registrations (default scope)', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'global-ok',
        events: ['tick'],
        handler: ({ event, actions }) => actions.log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('global-ok', 'log', log);
    runtime.fireSync('tick', 1);
    expect(log).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe('scope — mismatch is silent no-op + DEV warning', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('scoped trigger ignores global registration (and warns once)', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'scoped-vs-global',
        scope: 'chat',
        events: ['tick'],
        required: ['user'],
        handler: ({ conditions, actions, event }) => {
          if (!conditions.user) return;
          actions.log?.(event.payload);
        },
      },
      runtime,
    );
    // Both registrations are global (scope=''), trigger scope is 'chat' → ignored.
    runtime.registerCondition('scoped-vs-global', 'user', () => ({ id: 'alice' }));
    runtime.registerAction('scoped-vs-global', 'log', log);
    runtime.fireSync('tick', 1);
    expect(log).not.toHaveBeenCalled();
    // Two distinct scope mismatches (one per port name) → two warnings.
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain('scope mismatch');
  });

  it('global trigger ignores scoped registration', () => {
    const runtime = createRuntime();
    const log = vi.fn();
    createTrigger<Schema>(
      {
        id: 'global-vs-scoped',
        events: ['tick'],
        handler: ({ actions, event }) => actions.log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('global-vs-scoped', 'log', log, { scope: 'chat' });
    runtime.fireSync('tick', 1);
    expect(log).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once per (label, triggerId, scope, name) — no spam', () => {
    const runtime = createRuntime();
    createTrigger<Schema>(
      {
        id: 'spam',
        scope: 'chat',
        events: ['tick'],
        handler() {},
      },
      runtime,
    );
    // Same (label, name, scope) mismatch repeated → only one warning.
    runtime.registerCondition('spam', 'user', () => ({ id: 'A' }));
    runtime.registerCondition('spam', 'user', () => ({ id: 'B' }));
    runtime.registerCondition('spam', 'user', () => ({ id: 'C' }));
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('scope — isolation between scopes', () => {
  it('two scoped triggers with different scope ids do not cross-contaminate', () => {
    const runtime = createRuntime();
    const logChat = vi.fn();
    const logForum = vi.fn();
    createTrigger<Schema>(
      {
        id: 't-chat',
        scope: 'chat',
        events: ['tick'],
        handler: ({ actions, event }) => actions.log?.(event.payload),
      },
      runtime,
    );
    createTrigger<Schema>(
      {
        id: 't-forum',
        scope: 'forum',
        events: ['tick'],
        handler: ({ actions, event }) => actions.log?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction('t-chat', 'log', logChat, { scope: 'chat' });
    runtime.registerAction('t-forum', 'log', logForum, { scope: 'forum' });
    runtime.fireSync('tick', 1);
    expect(logChat).toHaveBeenCalledExactlyOnceWith(1);
    expect(logForum).toHaveBeenCalledExactlyOnceWith(1);
  });
});
