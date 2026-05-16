import { createRuntime, createTrigger } from '@triggery/core';
import { bench, describe } from 'vitest';

describe('dispatch — empty registry', () => {
  const runtime = createRuntime();
  bench('fireEvent (no triggers)', () => {
    runtime.fireSync('noop', undefined);
  });
});

describe('dispatch — single trigger, no conditions, one action', () => {
  const runtime = createRuntime();
  const acc = { calls: 0 };
  createTrigger<{
    events: { tick: number };
    actions: { count: number };
  }>(
    {
      id: 'single-tick',
      events: ['tick'],
      handler({ event, actions }) {
        actions.count?.(event.payload);
      },
    },
    runtime,
  );
  runtime.registerAction('single-tick', 'count', (n) => {
    acc.calls += n as number;
  });
  bench('fireEvent.sync', () => {
    runtime.fireSync('tick', 1);
  });

  // Same setup, inspector off — matches the production default.
  const prodRuntime = createRuntime({ inspector: false });
  const prodAcc = { calls: 0 };
  createTrigger<{
    events: { tick: number };
    actions: { count: number };
  }>(
    {
      id: 'single-tick-prod',
      events: ['tick'],
      handler({ event, actions }) {
        actions.count?.(event.payload);
      },
    },
    prodRuntime,
  );
  prodRuntime.registerAction('single-tick-prod', 'count', (n) => {
    prodAcc.calls += n as number;
  });
  bench('fireEvent.sync (prod)', () => {
    prodRuntime.fireSync('tick', 1);
  });
});

describe('dispatch — 10 triggers / 2 conditions / 1 action', () => {
  const runtime = createRuntime();
  for (let i = 0; i < 10; i++) {
    createTrigger<{
      events: { tick: number };
      conditions: { a: number; b: number };
      actions: { ok: void };
    }>(
      {
        id: `trigger-${i}`,
        events: ['tick'],
        required: ['a', 'b'],
        handler({ conditions, actions }) {
          if (
            conditions.a !== undefined &&
            conditions.b !== undefined &&
            conditions.a > -1 &&
            conditions.b > -1
          ) {
            actions.ok?.();
          }
        },
      },
      runtime,
    );
    runtime.registerCondition(`trigger-${i}`, 'a', () => 1);
    runtime.registerCondition(`trigger-${i}`, 'b', () => 2);
    runtime.registerAction(`trigger-${i}`, 'ok', () => {});
  }
  bench('fireEvent.sync', () => {
    runtime.fireSync('tick', 1);
  });

  // Same setup, inspector off — matches the production default.
  const prodRuntime = createRuntime({ inspector: false });
  for (let i = 0; i < 10; i++) {
    createTrigger<{
      events: { tick: number };
      conditions: { a: number; b: number };
      actions: { ok: void };
    }>(
      {
        id: `trigger-${i}-prod`,
        events: ['tick'],
        required: ['a', 'b'],
        handler({ conditions, actions }) {
          if (
            conditions.a !== undefined &&
            conditions.b !== undefined &&
            conditions.a > -1 &&
            conditions.b > -1
          ) {
            actions.ok?.();
          }
        },
      },
      prodRuntime,
    );
    prodRuntime.registerCondition(`trigger-${i}-prod`, 'a', () => 1);
    prodRuntime.registerCondition(`trigger-${i}-prod`, 'b', () => 2);
    prodRuntime.registerAction(`trigger-${i}-prod`, 'ok', () => {});
  }
  bench('fireEvent.sync (prod)', () => {
    prodRuntime.fireSync('tick', 1);
  });
});
