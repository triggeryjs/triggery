/**
 * Scenario 3 — cascade (A → B).
 *
 * One event fires synchronously inside the handler of another. Models the
 * "received message → bump unread → re-render badge" pattern: one user
 * action ends up touching two pieces of business logic.
 *
 * Each lib expresses the chain its own way:
 *   - Triggery: t-a's action calls runtime.fireSync('b'); t-b reacts
 *   - effector: forward(eventA → eventB) + watch on B
 *   - rxjs:     subjectA.subscribe(payload => subjectB.next(payload))
 *   - saga:     takeEvery('A', function*(){ yield put({type:'B'}) }) + takeEvery('B', …)
 *   - xstate:   transition on A raises B; B's transition runs the action
 *
 * Counter is bumped only by B's handler so we know the chain completed.
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { createEffect, createEvent, forward } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { put, takeEvery } from 'redux-saga/effects';
import { Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine, raise } from 'xstate';

describe('comparison — cascade (event A → handler → event B → handler)', () => {
  // ─── Triggery ────────────────────────────────────────────────────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  createTrigger<{ events: { a: number }; actions: { goB: number } }>(
    {
      id: 't-a',
      events: ['a'],
      handler: ({ event, actions }) => actions.goB?.(event.payload),
    },
    tRuntime,
  );
  createTrigger<{ events: { b: number } }>(
    {
      id: 't-b',
      events: ['b'],
      handler: ({ event }) => {
        triggeryAcc.n += event.payload;
      },
    },
    tRuntime,
  );
  tRuntime.registerAction('t-a', 'goB', (n) => tRuntime.fireSync('b', n));
  bench('triggery', () => {
    tRuntime.fireSync('a', 1);
  });

  // ─── effector ────────────────────────────────────────────────────────────
  const effectorAcc = { n: 0 };
  const eA = createEvent<number>();
  const eB = createEvent<number>();
  forward({ from: eA, to: eB });
  const eB$ = createEffect((n: number) => {
    effectorAcc.n += n;
  });
  eB.watch((n) => eB$(n));
  bench('effector', () => {
    eA(1);
  });

  // ─── rxjs ────────────────────────────────────────────────────────────────
  const rxjsAcc = { n: 0 };
  const subjA = new Subject<number>();
  const subjB = new Subject<number>();
  subjA.subscribe((n) => subjB.next(n));
  subjB.subscribe((n) => {
    rxjsAcc.n += n;
  });
  bench('rxjs', () => {
    subjA.next(1);
  });

  // ─── redux-saga ──────────────────────────────────────────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore((s = 0) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    yield takeEvery('A', function* (action: { type: string; payload: number }) {
      yield put({ type: 'B', payload: action.payload });
    });
    yield takeEvery('B', function* (action: { type: string; payload: number }) {
      sagaAcc.n += action.payload;
      yield;
    });
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: 'A', payload: 1 });
  });

  // ─── xstate ──────────────────────────────────────────────────────────────
  const xstateMachine = createMachine({
    types: {} as {
      events: { type: 'A'; payload: number } | { type: 'B'; payload: number };
      context: { acc: number };
    },
    context: { acc: 0 },
    on: {
      A: { actions: raise(({ event }) => ({ type: 'B' as const, payload: event.payload })) },
      B: { actions: assign({ acc: ({ context, event }) => context.acc + event.payload }) },
    },
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: 'A', payload: 1 });
  });
});
