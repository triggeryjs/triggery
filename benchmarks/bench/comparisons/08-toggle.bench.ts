/**
 * Scenario 8 — frequent enable/disable (feature flag toggling).
 *
 * "Bound to a feature flag that flips a few times a second". Each iteration:
 * toggle the on/off switch, fire one event. Half the fires are blocked, half
 * pass through.
 *
 * Triggery has a first-class `trigger.enable()` / `.disable()` — flipping a
 * boolean. The dispatcher checks it before doing anything else. Every other
 * library here has to fake "off" by either tearing down the subscription
 * (rxjs/saga), gating via a store/guard (effector/xstate), or both.
 *
 * Implementations:
 *   - Triggery: trigger.enable() / trigger.disable() + fire.
 *   - rxjs: unsubscribe() / subscribe() + next() — re-creates subscription each toggle.
 *   - effector: store-flag toggle + event; sample with filter blocks "off" fires.
 *   - redux-saga: re-fork/cancel of takeEvery worker.
 *   - xstate: assign'd flag + guarded transition.
 *
 * What we're measuring: how cheap is the "toggle + fire" cycle when business
 * logic flips on a flag many times per render cycle (think: dev mode, A/B
 * tests, role changes during a session).
 */

import { createRuntime, createTrigger, type Trigger } from '@triggery/core';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware, { type Task } from 'redux-saga';
import { takeEvery } from 'redux-saga/effects';
import { Subject, type Subscription } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

describe('comparison — toggle enable/disable (every iter: toggle + fire)', () => {
  // ─── Triggery (default — first-class enable/disable) ────────────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  const tTrigger: Trigger<{ events: { e: number }; actions: { log: number } }> = createTrigger(
    {
      id: 'toggle',
      events: ['e'],
      handler: ({ event, actions }) => actions.log?.(event.payload),
    },
    tRuntime,
  );
  tRuntime.registerAction('toggle', 'log', (n) => {
    triggeryAcc.n += n as number;
  });
  let tOn = true;
  bench('triggery', () => {
    if (tOn) tTrigger.disable();
    else tTrigger.enable();
    tOn = !tOn;
    tRuntime.fireSync('e', 1);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tProdAcc = { n: 0 };
  const tProdRuntime = createRuntime({ inspector: false });
  const tProdTrigger: Trigger<{ events: { e: number }; actions: { log: number } }> = createTrigger(
    {
      id: 'toggle-prod',
      events: ['e'],
      handler: ({ event, actions }) => actions.log?.(event.payload),
    },
    tProdRuntime,
  );
  tProdRuntime.registerAction('toggle-prod', 'log', (n) => {
    tProdAcc.n += n as number;
  });
  let tProdOn = true;
  bench('triggery (prod)', () => {
    if (tProdOn) tProdTrigger.disable();
    else tProdTrigger.enable();
    tProdOn = !tProdOn;
    tProdRuntime.fireSync('e', 1);
  });

  // ─── effector (store flag + sample filter) ───────────────────────────────
  const effectorAcc = { n: 0 };
  const eToggle = createEvent<boolean>();
  const eEvent = createEvent<number>();
  const $enabled = createStore(true).on(eToggle, (_, v) => v);
  const eFx = createEffect((n: number) => {
    effectorAcc.n += n;
  });
  sample({
    clock: eEvent,
    source: $enabled,
    filter: (enabled) => enabled,
    fn: (_, payload) => payload,
    target: eFx,
  });
  let eOn = true;
  bench('effector', () => {
    eToggle(!eOn);
    eOn = !eOn;
    eEvent(1);
  });

  // ─── rxjs (re-subscribe / unsubscribe each toggle) ───────────────────────
  const rxjsAcc = { n: 0 };
  const subject = new Subject<number>();
  let sub: Subscription | undefined = subject.subscribe((n) => {
    rxjsAcc.n += n;
  });
  bench('rxjs', () => {
    if (sub) {
      sub.unsubscribe();
      sub = undefined;
    } else {
      sub = subject.subscribe((n) => {
        rxjsAcc.n += n;
      });
    }
    subject.next(1);
  });

  // ─── redux-saga (cancel + re-fork takeEvery worker) ──────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore((s = 0) => s, applyMiddleware(sagaMw));
  function* worker(action: { type: string; payload: number }) {
    sagaAcc.n += action.payload;
    yield;
  }
  function* watcher() {
    yield takeEvery('E', worker);
  }
  let sagaTask: Task = sagaMw.run(watcher);
  bench('redux-saga', () => {
    if (sagaTask.isRunning()) {
      sagaTask.cancel();
    } else {
      sagaTask = sagaMw.run(watcher);
    }
    sagaStore.dispatch({ type: 'E', payload: 1 });
  });

  // ─── xstate (context flag + guarded transition) ──────────────────────────
  const xstateMachine = createMachine({
    types: {} as {
      events: { type: 'TOGGLE' } | { type: 'E'; payload: number };
      context: { enabled: boolean; acc: number };
    },
    context: { enabled: true, acc: 0 },
    on: {
      TOGGLE: { actions: assign({ enabled: ({ context }) => !context.enabled }) },
      E: {
        guard: ({ context }) => context.enabled,
        actions: assign({ acc: ({ context, event }) => context.acc + event.payload }),
      },
    },
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: 'TOGGLE' });
    xstateActor.send({ type: 'E', payload: 1 });
  });
});
