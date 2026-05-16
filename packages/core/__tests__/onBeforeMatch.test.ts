import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger, type MatchContext, type Middleware } from '../src/index.ts';

describe('middleware.onBeforeMatch', () => {
  it('fires once per (event, trigger) pair, after onFire and before the handler', () => {
    const events: string[] = [];
    const middleware: Middleware = {
      name: 'tracer',
      onFire: ({ eventName }) => {
        events.push(`onFire:${eventName}`);
      },
      onBeforeMatch: (ctx) => {
        events.push(`onBeforeMatch:${ctx.triggerId}:${ctx.eventName}`);
      },
      onActionStart: (ctx) => {
        events.push(`onActionStart:${ctx.actionName}`);
      },
    };
    const runtime = createRuntime({ middleware: [middleware] });
    const action = vi.fn();

    const trigger = createTrigger<{
      events: { ping: number };
      actions: { hit: number };
    }>(
      {
        id: 't',
        events: ['ping'],
        handler: ({ event, actions }) => actions.hit?.(event.payload),
      },
      runtime,
    );
    runtime.registerAction(trigger.id, 'hit', action);
    runtime.fireSync('ping', 1);

    expect(events).toEqual(['onFire:ping', 'onBeforeMatch:t:ping', 'onActionStart:hit']);
    expect(action).toHaveBeenCalledWith(1);
  });

  it('fires for every matching trigger even when one of them skips', () => {
    const matches: MatchContext[] = [];
    const middleware: Middleware = {
      name: 'recorder',
      onBeforeMatch: (ctx) => {
        matches.push(ctx);
      },
    };
    const runtime = createRuntime({ middleware: [middleware] });
    const a = createTrigger<{
      events: { tap: number };
      conditions: { ready: boolean };
      actions: { ack: number };
    }>(
      {
        id: 'a',
        events: ['tap'],
        required: ['ready'],
        handler: ({ event, actions, conditions }) => {
          if (conditions.ready) actions.ack?.(event.payload);
        },
      },
      runtime,
    );
    createTrigger<{ events: { tap: number } }>(
      {
        id: 'b',
        events: ['tap'],
        handler: () => {},
      },
      runtime,
    );

    // 'a' has required: ['ready'] but no provider → skipped.
    runtime.fireSync('tap', 7);

    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.triggerId).sort()).toEqual(['a', 'b']);
    for (const m of matches) {
      expect(m.eventName).toBe('tap');
      expect(m.payload).toBe(7);
      expect(m.cascadeDepth).toBe(0);
    }
    void a;
  });

  it('is omitted from the dispatch hot path when no middleware defines it', () => {
    // Smoke: the runtime should not blow up when middleware is absent.
    const runtime = createRuntime();
    const action = vi.fn();
    const trigger = createTrigger<{
      events: { go: void };
      actions: { ack: void };
    }>(
      {
        id: 'plain',
        events: ['go'],
        handler: ({ actions }) => actions.ack?.(),
      },
      runtime,
    );
    runtime.registerAction(trigger.id, 'ack', action);
    runtime.fireSync('go');
    expect(action).toHaveBeenCalledOnce();
  });
});
