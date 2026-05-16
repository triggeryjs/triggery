/**
 * Scenario 5 — sparse event bus (100 event types, fire targets one).
 *
 * Models the "shared dispatcher routes typed events to typed handlers"
 * pattern common in big apps. The fire hits one logical channel out of
 * 100; we want to know how much work each library does to route to the
 * right handler.
 *
 * Implementation choice per lib follows the most idiomatic "router" form:
 *   - Triggery: 100 triggers, one event each. Map<eventName, Set<Trigger>>
 *     gives O(1) lookup.
 *   - effector: 100 events. The "router" is the event identity itself —
 *     calling one event only notifies its own subscribers (also O(1)).
 *   - rxjs: ONE shared Subject + 100 `pipe(filter(e => e.type === 'X'))`
 *     subscriptions. This is the standard "event bus" pattern, but every
 *     emit re-runs all 100 filters — O(N).
 *   - redux-saga: ONE store, 100 `takeEvery(type, …)` watchers. Saga has
 *     internal type-to-channel routing similar to indexed dispatch.
 *   - xstate: ONE machine, 100 transitions in `on:`. Tabular dispatch.
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { createEvent } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { takeEvery } from 'redux-saga/effects';
import { filter, Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

const N = 100;
const TARGET = 'event42';
const TARGET_INDEX = 42;

describe('comparison — sparse event bus (100 event types, fire 1)', () => {
  // ─── Triggery (default) ──────────────────────────────────────────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  for (let i = 0; i < N; i++) {
    createTrigger<{ events: Record<string, number> }>(
      {
        id: `t${i}`,
        events: [`event${i}`],
        handler: ({ event }) => {
          triggeryAcc.n += event.payload as number;
        },
      },
      tRuntime,
    );
  }
  bench('triggery', () => {
    tRuntime.fireSync(TARGET, 1);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tProdAcc = { n: 0 };
  const tProdRuntime = createRuntime({ inspector: false });
  for (let i = 0; i < N; i++) {
    createTrigger<{ events: Record<string, number> }>(
      {
        id: `t${i}-prod`,
        events: [`event${i}`],
        handler: ({ event }) => {
          tProdAcc.n += event.payload as number;
        },
      },
      tProdRuntime,
    );
  }
  bench('triggery (prod)', () => {
    tProdRuntime.fireSync(TARGET, 1);
  });

  // ─── effector (100 events — equivalent to indexed dispatch) ──────────────
  const effectorAcc = { n: 0 };
  const eEvents = Array.from({ length: N }, () => createEvent<number>());
  for (const e of eEvents) {
    e.watch((n) => {
      effectorAcc.n += n;
    });
  }
  bench('effector', () => {
    eEvents[TARGET_INDEX]?.(1);
  });

  // ─── rxjs (shared Subject + 100 filter subscriptions) ────────────────────
  const rxjsAcc = { n: 0 };
  const bus = new Subject<{ type: string; payload: number }>();
  for (let i = 0; i < N; i++) {
    const typeName = `event${i}`;
    bus.pipe(filter((e) => e.type === typeName)).subscribe((e) => {
      rxjsAcc.n += e.payload;
    });
  }
  bench('rxjs', () => {
    bus.next({ type: TARGET, payload: 1 });
  });

  // ─── redux-saga (1 store + 100 takeEvery) ────────────────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore((s = 0) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    for (let i = 0; i < N; i++) {
      yield takeEvery(`event${i}`, function* (action: { type: string; payload: number }) {
        sagaAcc.n += action.payload;
        yield;
      });
    }
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: TARGET, payload: 1 });
  });

  // ─── xstate (1 machine, 100 transitions in on:) ──────────────────────────
  // biome-ignore lint/suspicious/noExplicitAny: dynamic transitions table needs loose typing
  const xOnHandlers: Record<string, any> = {};
  for (let i = 0; i < N; i++) {
    xOnHandlers[`event${i}`] = {
      actions: assign({
        // biome-ignore lint/suspicious/noExplicitAny: payload type varies per event in this sparse bus
        acc: ({ context, event }: any) => context.acc + event.payload,
      }),
    };
  }
  const xstateMachine = createMachine({
    context: { acc: 0 },
    on: xOnHandlers,
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: TARGET, payload: 1 });
  });
});
