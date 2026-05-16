/**
 * Scenario 10 — lazy conditions at scale.
 *
 * Scaled-up version of scenario 6. The runtime knows about 10 sources, all
 * mutated on every iteration ("source churn"), but the handler reads only
 * one — and which one rotates between iterations based on event.payload.
 *
 * Per iter:
 *   1. write all 10 sources (simulating state churn in the host app)
 *   2. fire the clock event
 *   3. handler reads exactly ONE source, indexed by `event.payload % 10`
 *
 * Triggery's pull-only conditions treat source updates as plain variable
 * writes — zero notify cost. The handler reads one getter through the lazy
 * proxy, that's the entire read cost.
 *
 * Other libraries that bind state into reactive primitives (effector
 * `combine`, redux reducer, xstate assign) pay an update cost for ALL 10
 * sources on every iter — work the handler doesn't end up using.
 */

import { atom } from '@reatom/core';
import { createRuntime, createTrigger } from '@triggery/core';
import { combine, createEffect, createEvent, createStore, sample } from 'effector';
import { configure, observable, reaction } from 'mobx';

configure({ enforceActions: 'never' });

import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { select, takeEvery } from 'redux-saga/effects';
import { BehaviorSubject, Subject, withLatestFrom } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

const N = 10;

describe('comparison — lazy conditions at scale (10 sources update each iter, handler reads 1 rotating)', () => {
  let tick = 0;

  // ─── Triggery (default) ──────────────────────────────────────────────────
  const tAcc = { n: 0 };
  const tSources = new Array(N).fill(0);
  const tRuntime = createRuntime();
  createTrigger<{
    events: { clock: number };
    conditions: Record<string, number>;
  }>(
    {
      id: 'lazy-scale',
      events: ['clock'],
      handler: ({ event, conditions }) => {
        const idx = (event.payload as number) % N;
        tAcc.n += (conditions[`v${idx}`] as number) ?? 0;
      },
    },
    tRuntime,
  );
  for (let i = 0; i < N; i++) {
    tRuntime.registerCondition('lazy-scale', `v${i}`, () => tSources[i] as number);
  }
  bench('triggery', () => {
    for (let i = 0; i < N; i++) tSources[i] = i + 1;
    tRuntime.fireSync('clock', tick++);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tpAcc = { n: 0 };
  const tpSources = new Array(N).fill(0);
  const tpRuntime = createRuntime({ inspector: false });
  createTrigger<{
    events: { clock: number };
    conditions: Record<string, number>;
  }>(
    {
      id: 'lazy-scale-prod',
      events: ['clock'],
      handler: ({ event, conditions }) => {
        const idx = (event.payload as number) % N;
        tpAcc.n += (conditions[`v${idx}`] as number) ?? 0;
      },
    },
    tpRuntime,
  );
  for (let i = 0; i < N; i++) {
    tpRuntime.registerCondition('lazy-scale-prod', `v${i}`, () => tpSources[i] as number);
  }
  bench('triggery (prod)', () => {
    for (let i = 0; i < N; i++) tpSources[i] = i + 1;
    tpRuntime.fireSync('clock', tick++);
  });

  // ─── effector (10 stores combined; handler picks one) ────────────────────
  const eAcc = { n: 0 };
  const eUpdates = Array.from({ length: N }, () => createEvent<number>());
  const eStores = eUpdates.map((evt) => createStore(0).on(evt, (_, v) => v));
  const $eAll = combine(eStores);
  const eClock = createEvent<number>();
  const eFx = createEffect((p: { all: number[]; payload: number }) => {
    const idx = p.payload % N;
    eAcc.n += p.all[idx] ?? 0;
  });
  sample({
    clock: eClock,
    source: $eAll,
    fn: (all, payload) => ({ all, payload }),
    target: eFx,
  });
  bench('effector', () => {
    for (let i = 0; i < N; i++) eUpdates[i]?.(i + 1);
    eClock(tick++);
  });

  // ─── rxjs (10 BehaviorSubjects + withLatestFrom of tuple) ────────────────
  const rAcc = { n: 0 };
  const rSubs = Array.from({ length: N }, () => new BehaviorSubject(0));
  const rClock = new Subject<number>();
  rClock
    .pipe(
      withLatestFrom(
        rSubs[0]!,
        rSubs[1]!,
        rSubs[2]!,
        rSubs[3]!,
        rSubs[4]!,
        rSubs[5]!,
        rSubs[6]!,
        rSubs[7]!,
        rSubs[8]!,
        rSubs[9]!,
      ),
    )
    .subscribe(([payload, ...vals]) => {
      const idx = payload % N;
      rAcc.n += vals[idx] ?? 0;
    });
  bench('rxjs', () => {
    for (let i = 0; i < N; i++) rSubs[i]?.next(i + 1);
    rClock.next(tick++);
  });

  // ─── redux-saga (1 store with 10 keys, saga selects one) ─────────────────
  type SagaState = number[];
  const sAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore(
    (
      s: SagaState = new Array(N).fill(0) as SagaState,
      a: { type: string; idx?: number; value?: number },
    ): SagaState => {
      if (a.type === 'UPDATE' && a.idx !== undefined && a.value !== undefined) {
        const next = s.slice();
        next[a.idx] = a.value;
        return next;
      }
      return s;
    },
    applyMiddleware(sagaMw),
  );
  sagaMw.run(function* () {
    yield takeEvery('CLOCK', function* (action: { type: string; payload: number }) {
      const s: SagaState = yield select();
      const idx = action.payload % N;
      sAcc.n += s[idx] ?? 0;
    });
  });
  bench('redux-saga', () => {
    for (let i = 0; i < N; i++) sagaStore.dispatch({ type: 'UPDATE', idx: i, value: i + 1 });
    sagaStore.dispatch({ type: 'CLOCK', payload: tick++ });
  });

  // ─── xstate (10 context fields, CLOCK reads one) ─────────────────────────
  const xMachine = createMachine({
    types: {} as {
      events: { type: 'UPDATE'; idx: number; value: number } | { type: 'CLOCK'; payload: number };
      context: { values: number[]; acc: number };
    },
    context: { values: new Array(N).fill(0), acc: 0 },
    on: {
      UPDATE: {
        actions: assign(({ context, event }) => {
          const next = context.values.slice();
          next[event.idx] = event.value;
          return { ...context, values: next };
        }),
      },
      CLOCK: {
        actions: assign({
          acc: ({ context, event }) => {
            const idx = event.payload % N;
            return context.acc + (context.values[idx] ?? 0);
          },
        }),
      },
    },
  });
  const xActor = createActor(xMachine).start();
  bench('xstate', () => {
    for (let i = 0; i < N; i++) xActor.send({ type: 'UPDATE', idx: i, value: i + 1 });
    xActor.send({ type: 'CLOCK', payload: tick++ });
  });

  // ─── Reatom (10 atoms + clock atom; subscriber reads one) ────────────────
  const reAcc = { n: 0 };
  const reAtoms = Array.from({ length: N }, () => atom(0));
  const $reClock = atom(0);
  $reClock.subscribe((value) => {
    const idx = value % N;
    reAcc.n += reAtoms[idx]?.() ?? 0;
  });
  bench('reatom', () => {
    for (let i = 0; i < N; i++) reAtoms[i]?.set(i + 1);
    $reClock.set((v) => v + 1);
  });

  // ─── MobX (10 observables + clock observable; reaction reads one) ────────
  const moAcc = { n: 0 };
  const moBoxes = Array.from({ length: N }, () => observable.box(0));
  const moClock = observable.box(0);
  reaction(
    () => moClock.get(),
    (value) => {
      const idx = value % N;
      moAcc.n += moBoxes[idx]?.get() ?? 0;
    },
  );
  bench('mobx', () => {
    for (let i = 0; i < N; i++) moBoxes[i]?.set(i + 1);
    moClock.set(moClock.get() + 1);
  });
});
