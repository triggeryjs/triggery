/**
 * Scenario 1 — plain dispatch.
 *
 * Fire a single event, run one side-effect with the payload. No conditions,
 * no filters. Isolates the dispatch hot path of each library when there's
 * exactly one subscriber doing the smallest meaningful piece of work
 * (increment a number).
 *
 * Every implementation does the same thing:
 *   1. wire one event/transition/observable to one action that adds
 *      `event.payload` to a counter.
 *   2. inside `bench()`, fire the event with payload=1.
 *
 * Setup happens once per `describe`, so the bench body measures only the
 * dispatch + handler cost.
 */

import { atom } from '@reatom/core';
import { createRuntime, createTrigger } from '@triggery/core';
import { createEffect, createEvent, sample } from 'effector';
import { configure, observable, reaction } from 'mobx';
import { applyMiddleware, createStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { takeEvery } from 'redux-saga/effects';
import { Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

// MobX warns by default when you mutate observable state outside `action()`.
// Bench code mutates synchronously, so we silence the warning once globally.
configure({ enforceActions: 'never' });

describe('comparison — plain dispatch (event → +1 action)', () => {
  // ─── Triggery (default — inspector on; matches dev/test envs) ────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  createTrigger<{ events: { e: number }; actions: { log: number } }>(
    {
      id: 'plain',
      events: ['e'],
      handler: ({ event, actions }) => actions.log?.(event.payload),
    },
    tRuntime,
  );
  tRuntime.registerAction('plain', 'log', (n) => {
    triggeryAcc.n += n as number;
  });
  bench('triggery', () => {
    tRuntime.fireSync('e', 1);
  });

  // ─── Triggery (prod — inspector off; matches production default) ────────
  const tProdAcc = { n: 0 };
  const tProdRuntime = createRuntime({ inspector: false });
  createTrigger<{ events: { e: number }; actions: { log: number } }>(
    {
      id: 'plain-prod',
      events: ['e'],
      handler: ({ event, actions }) => actions.log?.(event.payload),
    },
    tProdRuntime,
  );
  tProdRuntime.registerAction('plain-prod', 'log', (n) => {
    tProdAcc.n += n as number;
  });
  bench('triggery (prod)', () => {
    tProdRuntime.fireSync('e', 1);
  });

  // ─── effector ────────────────────────────────────────────────────────────
  const effectorAcc = { n: 0 };
  const eEvent = createEvent<number>();
  const eEffect = createEffect((n: number) => {
    effectorAcc.n += n;
  });
  sample({ clock: eEvent, target: eEffect });
  bench('effector', () => {
    eEvent(1);
  });

  // ─── rxjs ────────────────────────────────────────────────────────────────
  const rxjsAcc = { n: 0 };
  const subject = new Subject<number>();
  subject.subscribe((n) => {
    rxjsAcc.n += n;
  });
  bench('rxjs', () => {
    subject.next(1);
  });

  // ─── redux-saga ──────────────────────────────────────────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createStore((s = 0) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    yield takeEvery('E', function* (action: { type: string; payload: number }) {
      sagaAcc.n += action.payload;
      yield;
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

  // ─── Reatom (atom + subscribe) ───────────────────────────────────────────
  // Reatom 1001 doesn't have an "event" primitive in the same sense — the
  // closest pattern for "fire X, run handler" is "mutate atom, subscriber
  // reacts". We use a counter atom and count subscriber invocations.
  const reatomAcc = { n: 0 };
  const $reatomState = atom(0);
  $reatomState.subscribe(() => {
    reatomAcc.n += 1;
  });
  bench('reatom', () => {
    $reatomState.set((v) => v + 1);
  });

  // ─── MobX (observable + reaction) ────────────────────────────────────────
  const mobxAcc = { n: 0 };
  const mobxBox = observable.box(0);
  reaction(
    () => mobxBox.get(),
    (val, prev) => {
      mobxAcc.n += val - prev;
    },
  );
  bench('mobx', () => {
    mobxBox.set(mobxBox.get() + 1);
  });
});
