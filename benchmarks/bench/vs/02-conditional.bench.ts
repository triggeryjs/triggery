/**
 * Scenario 2 — conditional dispatch.
 *
 * Same idea as scenario 1, but the action only runs when a guard is true.
 * To exercise both branches, the dispatcher alternates the flag value
 * across iterations (toggle on every fire) so each bench measures the
 * mix of "passes the guard" and "blocked by the guard".
 *
 * Each lib implements the guard idiomatically:
 *   - Triggery: `required` + early-return on the condition value
 *   - effector: `guard({ source, filter, target })`
 *   - rxjs:     `pipe(filter(...))`
 *   - saga:     `take` + `select` inside the saga
 *   - xstate:   transition with `guard`
 */

import { atom } from '@reatom/core';
import { createRuntime, createTrigger } from '@triggery/core';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { configure, observable, reaction } from 'mobx';

configure({ enforceActions: 'never' });

import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { select, takeEvery } from 'redux-saga/effects';
import { filter, Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

describe('comparison — conditional dispatch (alternating guard, 50% pass)', () => {
  // Shared toggle. Each bench increments and reads it (cheap modulo).
  let tick = 0;
  const flagFor = () => (tick++ & 1) === 0;

  // ─── Triggery (default) ──────────────────────────────────────────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  // Use a condition rather than a captured variable so the bench
  // exercises the snapshot + required path of the runtime.
  createTrigger<{
    events: { e: number };
    conditions: { enabled: boolean };
    actions: { log: number };
  }>(
    {
      id: 'cond',
      events: ['e'],
      required: ['enabled'],
      handler: ({ event, conditions, actions }) => {
        if (!conditions.enabled) return;
        actions.log?.(event.payload);
      },
    },
    tRuntime,
  );
  tRuntime.registerCondition('cond', 'enabled', () => flagFor());
  tRuntime.registerAction('cond', 'log', (n) => {
    triggeryAcc.n += n as number;
  });
  bench('triggery', () => {
    tRuntime.fireSync('e', 1);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tProdAcc = { n: 0 };
  const tProdRuntime = createRuntime({ inspector: false });
  createTrigger<{
    events: { e: number };
    conditions: { enabled: boolean };
    actions: { log: number };
  }>(
    {
      id: 'cond-prod',
      events: ['e'],
      required: ['enabled'],
      handler: ({ event, conditions, actions }) => {
        if (!conditions.enabled) return;
        actions.log?.(event.payload);
      },
    },
    tProdRuntime,
  );
  tProdRuntime.registerCondition('cond-prod', 'enabled', () => flagFor());
  tProdRuntime.registerAction('cond-prod', 'log', (n) => {
    tProdAcc.n += n as number;
  });
  bench('triggery (prod)', () => {
    tProdRuntime.fireSync('e', 1);
  });

  // ─── effector ────────────────────────────────────────────────────────────
  const effectorAcc = { n: 0 };
  const eEvent = createEvent<number>();
  const $enabled = createStore(true).on(eEvent, () => flagFor());
  const eEffect = createEffect((n: number) => {
    effectorAcc.n += n;
  });
  // `sample` with filter is the modern idiom in effector v23+ (`guard` is deprecated).
  sample({
    clock: eEvent,
    source: $enabled,
    filter: (enabled) => enabled,
    fn: (_, payload) => payload,
    target: eEffect,
  });
  bench('effector', () => {
    eEvent(1);
  });

  // ─── rxjs ────────────────────────────────────────────────────────────────
  const rxjsAcc = { n: 0 };
  const subject = new Subject<number>();
  subject.pipe(filter(() => flagFor())).subscribe((n) => {
    rxjsAcc.n += n;
  });
  bench('rxjs', () => {
    subject.next(1);
  });

  // ─── redux-saga ──────────────────────────────────────────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore(
    (s: { enabled: boolean } = { enabled: true }, a: { type: string }) => {
      if (a.type === 'E') return { enabled: flagFor() };
      return s;
    },
    applyMiddleware(sagaMw),
  );
  sagaMw.run(function* () {
    yield takeEvery('E', function* (action: { type: string; payload: number }) {
      const state: { enabled: boolean } = yield select();
      if (!state.enabled) return;
      sagaAcc.n += action.payload;
    });
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: 'E', payload: 1 });
  });

  // ─── xstate ──────────────────────────────────────────────────────────────
  const xstateMachine = createMachine({
    types: {} as { events: { type: 'E'; payload: number }; context: { acc: number } },
    context: { acc: 0 },
    on: {
      E: {
        guard: () => flagFor(),
        actions: assign({
          acc: ({ context, event }) => context.acc + event.payload,
        }),
      },
    },
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: 'E', payload: 1 });
  });

  // ─── Reatom (atom + subscribe with conditional add) ──────────────────────
  const reatomAcc = { n: 0 };
  const $reatomState = atom(0);
  $reatomState.subscribe(() => {
    if (flagFor()) reatomAcc.n += 1;
  });
  bench('reatom', () => {
    $reatomState.set((v) => v + 1);
  });

  // ─── MobX (observable + reaction with conditional add) ───────────────────
  const mobxAcc = { n: 0 };
  const mobxBox = observable.box(0);
  reaction(
    () => mobxBox.get(),
    () => {
      if (flagFor()) mobxAcc.n += 1;
    },
  );
  bench('mobx', () => {
    mobxBox.set(mobxBox.get() + 1);
  });
});
