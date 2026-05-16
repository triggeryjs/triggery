/**
 * Scenario 4 — take-latest cancellation.
 *
 * Search-as-you-type pattern: every new event must cancel any in-flight
 * async work from the previous event. The bench fires events as fast as
 * possible; the handler awaits one microtask, then checks the cancel
 * signal. Measures dispatch cost INCLUDING the cancel-previous + start-new
 * overhead each library imposes.
 *
 *   - Triggery: `concurrency: 'take-latest'` — built-in. Signal is passed
 *     into the handler automatically.
 *   - rxjs:     `switchMap` — switches to a new inner observable, cancelling
 *     the previous one. The classic FRP idiom for take-latest.
 *   - redux-saga: `takeLatest` — saga's named effect for this exact pattern.
 *   - effector: rolled by hand — sample maps the event to a fresh
 *     AbortController and clears the previous one. effector core has no
 *     dedicated take-latest primitive.
 *   - xstate:   invoke with a fixed id — re-entering the state cancels the
 *     prior invoke. Heaviest setup of the bunch because the cancel is wired
 *     through a state transition.
 *
 * The handler body is `await Promise.resolve()` so each library's overhead
 * dominates the measurement, not user work.
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { createEffect, createEvent, sample } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { delay, takeLatest } from 'redux-saga/effects';
import { Subject, switchMap } from 'rxjs';
import { bench, describe } from 'vitest';
import { createActor, createMachine, fromPromise } from 'xstate';

describe('comparison — take-latest (each fire cancels prior in-flight)', () => {
  // ─── Triggery ────────────────────────────────────────────────────────────
  const tRuntime = createRuntime();
  createTrigger<{ events: { e: number } }>(
    {
      id: 'tl',
      events: ['e'],
      concurrency: 'take-latest',
      handler: async ({ signal }) => {
        await Promise.resolve();
        if (signal.aborted) return;
      },
    },
    tRuntime,
  );
  bench('triggery', () => {
    tRuntime.fireSync('e', 1);
  });

  // ─── effector (manual AbortController wrapper) ───────────────────────────
  const eEvent = createEvent<number>();
  let effectorCtl: AbortController | undefined;
  const eFx = createEffect(async (p: { n: number; signal: AbortSignal }) => {
    await Promise.resolve();
    if (p.signal.aborted) return;
  });
  sample({
    clock: eEvent,
    fn: (n: number) => {
      effectorCtl?.abort('superseded');
      effectorCtl = new AbortController();
      return { n, signal: effectorCtl.signal };
    },
    target: eFx,
  });
  bench('effector', () => {
    eEvent(1);
  });

  // ─── rxjs (switchMap) ────────────────────────────────────────────────────
  const subject = new Subject<number>();
  subject
    .pipe(
      switchMap(async () => {
        await Promise.resolve();
      }),
    )
    .subscribe();
  bench('rxjs', () => {
    subject.next(1);
  });

  // ─── redux-saga (takeLatest) ─────────────────────────────────────────────
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore((s = 0) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    yield takeLatest('E', function* () {
      yield delay(0);
    });
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: 'E', payload: 1 });
  });

  // ─── xstate (invoke with cancel on re-entry) ─────────────────────────────
  const xstateMachine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { E: 'working' } },
      working: {
        invoke: {
          id: 'work',
          src: fromPromise(async () => {
            await Promise.resolve();
          }),
          onDone: 'idle',
        },
        // Re-entering `working` from itself cancels the previous invoke.
        on: { E: { target: 'working', reenter: true } },
      },
    },
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: 'E' });
  });
});
