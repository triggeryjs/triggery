/**
 * Scenario 9 — realistic medium-app event bus.
 *
 * Models the typical shape of business logic in a real app: many distinct
 * event types, each tied to one trigger that gates on a small condition set
 * and then dispatches an action. The bench rotates through 30 event types
 * so every fire takes a different route — no warm-up of one hot path.
 *
 * Per trigger:
 *   - 1 required condition (`flag` — boolean, always true here)
 *   - 1 readable condition (`factor` — number, used in payload calc)
 *   - 1 action (`update` — counter bump)
 *
 * Handler shape: gate on flag, read factor, call action with payload * factor.
 *
 * Combines three Triggery hot-path advantages on one bench:
 *   - indexed dispatch (Map<event, Set<trigger>>) → O(1) routing
 *   - required-gate (cheap skip if flag missing)
 *   - pull-only conditions (factor read only when handler reaches it)
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { takeEvery } from 'redux-saga/effects';
import { filter, Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

const N = 30;

describe('comparison — realistic app bus (30 events × 30 triggers + condition + action)', () => {
  let tick = 0;

  // ─── Triggery (default) ──────────────────────────────────────────────────
  const tAcc = { n: 0 };
  const tRuntime = createRuntime();
  for (let i = 0; i < N; i++) {
    const factor = i + 1;
    createTrigger<{
      events: Record<string, number>;
      conditions: { flag: boolean; factor: number };
      actions: { update: number };
    }>(
      {
        id: `t${i}`,
        events: [`e${i}`],
        required: ['flag'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.flag) return;
          actions.update?.(event.payload * (conditions.factor ?? 0));
        },
      },
      tRuntime,
    );
    tRuntime.registerCondition(`t${i}`, 'flag', () => true);
    tRuntime.registerCondition(`t${i}`, 'factor', () => factor);
    tRuntime.registerAction(`t${i}`, 'update', (n) => {
      tAcc.n += n as number;
    });
  }
  bench('triggery', () => {
    tRuntime.fireSync(`e${tick++ % N}`, 1);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tpAcc = { n: 0 };
  const tpRuntime = createRuntime({ inspector: false });
  for (let i = 0; i < N; i++) {
    const factor = i + 1;
    createTrigger<{
      events: Record<string, number>;
      conditions: { flag: boolean; factor: number };
      actions: { update: number };
    }>(
      {
        id: `t${i}-prod`,
        events: [`e${i}`],
        required: ['flag'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.flag) return;
          actions.update?.(event.payload * (conditions.factor ?? 0));
        },
      },
      tpRuntime,
    );
    tpRuntime.registerCondition(`t${i}-prod`, 'flag', () => true);
    tpRuntime.registerCondition(`t${i}-prod`, 'factor', () => factor);
    tpRuntime.registerAction(`t${i}-prod`, 'update', (n) => {
      tpAcc.n += n as number;
    });
  }
  bench('triggery (prod)', () => {
    tpRuntime.fireSync(`e${tick++ % N}`, 1);
  });

  // ─── effector (30 events, each with its own sample chain) ────────────────
  const eAcc = { n: 0 };
  const eEvents = Array.from({ length: N }, () => createEvent<number>());
  const eFx = createEffect((n: number) => {
    eAcc.n += n;
  });
  for (let i = 0; i < N; i++) {
    const $flag = createStore(true);
    const $factor = createStore(i + 1);
    sample({
      clock: eEvents[i] as ReturnType<typeof createEvent<number>>,
      source: { flag: $flag, factor: $factor },
      filter: (src) => src.flag,
      fn: (src, payload) => payload * src.factor,
      target: eFx,
    });
  }
  bench('effector', () => {
    eEvents[tick++ % N]?.(1);
  });

  // ─── rxjs (shared Subject + 30 filter subscriptions) ─────────────────────
  const rAcc = { n: 0 };
  const bus = new Subject<{ type: string; payload: number }>();
  for (let i = 0; i < N; i++) {
    const typeName = `e${i}`;
    const factor = i + 1;
    const flag = true;
    bus.pipe(filter((e) => e.type === typeName)).subscribe((e) => {
      if (!flag) return;
      rAcc.n += e.payload * factor;
    });
  }
  bench('rxjs', () => {
    bus.next({ type: `e${tick++ % N}`, payload: 1 });
  });

  // ─── redux-saga (1 store + 30 takeEvery, each with select for flag/factor) ───
  type SagaState = { flags: boolean[]; factors: number[] };
  const sAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const initialState: SagaState = {
    flags: Array.from({ length: N }, () => true),
    factors: Array.from({ length: N }, (_, i) => i + 1),
  };
  const sagaStore = createReduxStore((s: SagaState = initialState) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    for (let i = 0; i < N; i++) {
      yield takeEvery(`e${i}`, function* (action: { type: string; payload: number }) {
        const s = sagaStore.getState();
        if (!s.flags[i]) return;
        sAcc.n += action.payload * (s.factors[i] ?? 0);
        yield;
      });
    }
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: `e${tick++ % N}`, payload: 1 });
  });

  // ─── xstate (1 machine, 30 transitions in on:) ───────────────────────────
  // biome-ignore lint/suspicious/noExplicitAny: dynamic transition table needs loose typing
  const xOn: Record<string, any> = {};
  for (let i = 0; i < N; i++) {
    const factor = i + 1;
    xOn[`e${i}`] = {
      guard: ({ context }: { context: { flag: boolean } }) => context.flag,
      actions: assign({
        // biome-ignore lint/suspicious/noExplicitAny: payload type varies per event
        acc: ({ context, event }: any) => context.acc + event.payload * factor,
      }),
    };
  }
  const xMachine = createMachine({
    context: { acc: 0, flag: true },
    on: xOn,
  });
  const xActor = createActor(xMachine).start();
  bench('xstate', () => {
    xActor.send({ type: `e${tick++ % N}`, payload: 1 });
  });
});
