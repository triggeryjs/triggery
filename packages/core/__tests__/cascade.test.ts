import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

type AB = {
  events: { a: number; b: number };
  actions: { goB: number; goA: number };
};

describe('cascade — depth limit', () => {
  it('passes when depth ≤ maxCascadeDepth', () => {
    const onCascade = vi.fn();
    const runtime = createRuntime({
      maxCascadeDepth: 2,
      middleware: [{ name: 'spy', onCascade }],
    });
    const reachedB = vi.fn();

    createTrigger<AB>(
      {
        id: 't-a',
        events: ['a'],
        handler: ({ actions, event }) => actions.goB?.(event.payload + 1),
      },
      runtime,
    );
    createTrigger<AB>(
      {
        id: 't-b',
        events: ['b'],
        handler: ({ event }) => reachedB(event.payload),
      },
      runtime,
    );

    runtime.registerAction('t-a', 'goB', (n) => runtime.fireSync('b', n));
    runtime.fireSync('a', 1);
    expect(reachedB).toHaveBeenCalledExactlyOnceWith(2);
    expect(onCascade).not.toHaveBeenCalled();
  });

  it('fires onCascade with kind="overflow" when depth exceeds the limit', () => {
    const cascadeCalls: Array<{ kind: string; cascadeDepth: number }> = [];
    const runtime = createRuntime({
      maxCascadeDepth: 1,
      middleware: [{ name: 'spy', onCascade: (c) => cascadeCalls.push(c) }],
    });
    const reachedDeep = vi.fn();

    createTrigger<AB>(
      {
        id: 't-a',
        events: ['a'],
        handler: ({ actions, event }) => actions.goB?.(event.payload + 1),
      },
      runtime,
    );
    createTrigger<AB>(
      {
        id: 't-b',
        events: ['b'],
        handler: ({ actions, event }) => actions.goA?.(event.payload + 1),
      },
      runtime,
    );

    runtime.registerAction('t-a', 'goB', (n) => runtime.fireSync('b', n));
    runtime.registerAction('t-b', 'goA', (n) => {
      reachedDeep(n);
      runtime.fireSync('a', n);
    });

    runtime.fireSync('a', 0);
    // a (depth 0) → b (depth 1, allowed) → a (depth 2, overflow)
    expect(cascadeCalls).toHaveLength(1);
    expect(cascadeCalls[0]).toMatchObject({ kind: 'overflow', cascadeDepth: 2 });
  });
});

describe('cascade — cycle detection', () => {
  it('emits kind="cycle" when a trigger re-enters itself via the chain', () => {
    const cascadeCalls: Array<{ kind: string }> = [];
    const runtime = createRuntime({
      // Wide enough that the overflow gate doesn't fire first.
      maxCascadeDepth: 10,
      middleware: [{ name: 'spy', onCascade: (c) => cascadeCalls.push({ kind: c.kind }) }],
    });

    createTrigger<AB>(
      {
        id: 't-a',
        events: ['a'],
        handler: ({ actions }) => actions.goB?.(0),
      },
      runtime,
    );
    createTrigger<AB>(
      {
        id: 't-b',
        events: ['b'],
        handler: ({ actions }) => actions.goA?.(0),
      },
      runtime,
    );
    runtime.registerAction('t-a', 'goB', () => runtime.fireSync('b'));
    runtime.registerAction('t-b', 'goA', () => runtime.fireSync('a'));

    runtime.fireSync('a');
    // a → b adds 'a' then 'b' to chain. b → a sees 'a' in chain → cycle, skip.
    const cycleEvents = cascadeCalls.filter((c) => c.kind === 'cycle');
    expect(cycleEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('top-level fires never report cycle (chain resets each time)', () => {
    const onCascade = vi.fn();
    const runtime = createRuntime({ middleware: [{ name: 'spy', onCascade }] });
    const log = vi.fn();
    createTrigger<{ events: { tick: void } }>(
      {
        id: 'top',
        events: ['tick'],
        handler: () => log(),
      },
      runtime,
    );
    runtime.fireSync('tick');
    runtime.fireSync('tick');
    runtime.fireSync('tick');
    expect(log).toHaveBeenCalledTimes(3);
    expect(onCascade).not.toHaveBeenCalled();
  });
});

describe('cascade — meta context', () => {
  it('handler ctx.meta carries parentTriggerId / parentRunId for cascaded runs', () => {
    const runtime = createRuntime({ maxCascadeDepth: 5 });
    const seen: Array<{ id: string; depth: number; parent?: string }> = [];

    createTrigger<AB>(
      {
        id: 'top',
        events: ['a'],
        handler: ({ meta, actions }) => {
          seen.push({
            id: meta.triggerId,
            depth: meta.cascadeDepth,
            ...(meta.parentTriggerId !== undefined && { parent: meta.parentTriggerId }),
          });
          actions.goB?.(0);
        },
      },
      runtime,
    );
    createTrigger<AB>(
      {
        id: 'child',
        events: ['b'],
        handler: ({ meta }) => {
          seen.push({
            id: meta.triggerId,
            depth: meta.cascadeDepth,
            ...(meta.parentTriggerId !== undefined && { parent: meta.parentTriggerId }),
          });
        },
      },
      runtime,
    );
    runtime.registerAction('top', 'goB', () => runtime.fireSync('b'));
    runtime.fireSync('a');

    expect(seen).toEqual([
      { id: 'top', depth: 0 },
      { id: 'child', depth: 1, parent: 'top' },
    ]);
  });
});
