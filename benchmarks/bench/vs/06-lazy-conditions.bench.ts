/**
 * Scenario 6 — lazy conditions (5 sources update often, handler reads 1).
 *
 * Models "the runtime knows about 5 pieces of state but the trigger only
 * needs one of them in this branch of logic". Sources update on every
 * iteration; the clock event fires once per iteration; the handler reads
 * source #1.
 *
 * The bench measures FULL iteration cost: source updates + one dispatch.
 * Triggery's pull-only condition model treats source updates as free —
 * just an assignment to a variable. The other libraries route updates
 * through their state primitives, which costs per-update.
 *
 * Implementations:
 *   - Triggery: 5 registerCondition() getters reading plain variables;
 *     source update = variable assignment (zero notify cost).
 *   - effector: 5 stores updated via events; sample on clock reads s1.
 *   - rxjs: 5 BehaviorSubjects, withLatestFrom caches latest tuple,
 *     handler reads index 0.
 *   - redux-saga: store with 5 keys; saga selects s1 on each clock.
 *   - xstate: machine with 5 context fields; CLOCK transition reads s1.
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { combine, createEffect, createEvent, createStore, sample } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { select, takeEvery } from 'redux-saga/effects';
import { BehaviorSubject, Subject, withLatestFrom } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

describe('comparison — lazy conditions (5 sources update each iter, handler reads 1)', () => {
  // ─── Triggery (default) ──────────────────────────────────────────────────
  const triggeryAcc = { n: 0 };
  let tv1 = 0;
  let tv2 = 0;
  let tv3 = 0;
  let tv4 = 0;
  let tv5 = 0;
  const tRuntime = createRuntime();
  createTrigger<{ events: { clock: void }; conditions: { v1: number } }>(
    {
      id: 'lazy',
      events: ['clock'],
      required: ['v1'],
      handler: ({ conditions }) => {
        triggeryAcc.n += conditions.v1 ?? 0;
      },
    },
    tRuntime,
  );
  tRuntime.registerCondition('lazy', 'v1', () => tv1);
  tRuntime.registerCondition('lazy', 'v2', () => tv2);
  tRuntime.registerCondition('lazy', 'v3', () => tv3);
  tRuntime.registerCondition('lazy', 'v4', () => tv4);
  tRuntime.registerCondition('lazy', 'v5', () => tv5);
  bench('triggery', () => {
    // Source updates — plain variable writes, no notify.
    tv1 = 1;
    tv2 = 1;
    tv3 = 1;
    tv4 = 1;
    tv5 = 1;
    tRuntime.fireSync('clock');
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tProdAcc = { n: 0 };
  let tpv1 = 0;
  let tpv2 = 0;
  let tpv3 = 0;
  let tpv4 = 0;
  let tpv5 = 0;
  const tProdRuntime = createRuntime({ inspector: false });
  createTrigger<{ events: { clock: void }; conditions: { v1: number } }>(
    {
      id: 'lazy-prod',
      events: ['clock'],
      required: ['v1'],
      handler: ({ conditions }) => {
        tProdAcc.n += conditions.v1 ?? 0;
      },
    },
    tProdRuntime,
  );
  tProdRuntime.registerCondition('lazy-prod', 'v1', () => tpv1);
  tProdRuntime.registerCondition('lazy-prod', 'v2', () => tpv2);
  tProdRuntime.registerCondition('lazy-prod', 'v3', () => tpv3);
  tProdRuntime.registerCondition('lazy-prod', 'v4', () => tpv4);
  tProdRuntime.registerCondition('lazy-prod', 'v5', () => tpv5);
  bench('triggery (prod)', () => {
    tpv1 = 1;
    tpv2 = 1;
    tpv3 = 1;
    tpv4 = 1;
    tpv5 = 1;
    tProdRuntime.fireSync('clock');
  });

  // ─── effector (5 stores, sample reads only the one we need) ──────────────
  const effectorAcc = { n: 0 };
  const eUpd1 = createEvent<number>();
  const eUpd2 = createEvent<number>();
  const eUpd3 = createEvent<number>();
  const eUpd4 = createEvent<number>();
  const eUpd5 = createEvent<number>();
  const $s1 = createStore(0).on(eUpd1, (_, v) => v);
  const $s2 = createStore(0).on(eUpd2, (_, v) => v);
  const $s3 = createStore(0).on(eUpd3, (_, v) => v);
  const $s4 = createStore(0).on(eUpd4, (_, v) => v);
  const $s5 = createStore(0).on(eUpd5, (_, v) => v);
  // Tie all stores together so combine has to recompute on each update —
  // mirrors what happens when downstream readers need the full snapshot.
  const $all = combine([$s1, $s2, $s3, $s4, $s5]);
  const eClock = createEvent();
  const eFx = createEffect((v: number) => {
    effectorAcc.n += v;
  });
  sample({
    clock: eClock,
    source: $all,
    fn: ([v1]) => v1,
    target: eFx,
  });
  bench('effector', () => {
    eUpd1(1);
    eUpd2(1);
    eUpd3(1);
    eUpd4(1);
    eUpd5(1);
    eClock();
  });

  // ─── rxjs (5 BehaviorSubjects, withLatestFrom caches latest) ─────────────
  const rxjsAcc = { n: 0 };
  const rs1 = new BehaviorSubject(0);
  const rs2 = new BehaviorSubject(0);
  const rs3 = new BehaviorSubject(0);
  const rs4 = new BehaviorSubject(0);
  const rs5 = new BehaviorSubject(0);
  const rClock = new Subject<void>();
  rClock.pipe(withLatestFrom(rs1, rs2, rs3, rs4, rs5)).subscribe(([, v1]) => {
    rxjsAcc.n += v1;
  });
  bench('rxjs', () => {
    rs1.next(1);
    rs2.next(1);
    rs3.next(1);
    rs4.next(1);
    rs5.next(1);
    rClock.next();
  });

  // ─── redux-saga (single store with 5 keys, saga selects v1) ──────────────
  type SagaState = { v1: number; v2: number; v3: number; v4: number; v5: number };
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore(
    (
      s: SagaState = { v1: 0, v2: 0, v3: 0, v4: 0, v5: 0 },
      a: { type: string; key?: keyof SagaState; value?: number },
    ): SagaState => {
      if (a.type === 'UPDATE' && a.key && a.value !== undefined) {
        return { ...s, [a.key]: a.value };
      }
      return s;
    },
    applyMiddleware(sagaMw),
  );
  sagaMw.run(function* () {
    yield takeEvery('CLOCK', function* () {
      const s: SagaState = yield select();
      sagaAcc.n += s.v1;
    });
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: 'UPDATE', key: 'v1', value: 1 });
    sagaStore.dispatch({ type: 'UPDATE', key: 'v2', value: 1 });
    sagaStore.dispatch({ type: 'UPDATE', key: 'v3', value: 1 });
    sagaStore.dispatch({ type: 'UPDATE', key: 'v4', value: 1 });
    sagaStore.dispatch({ type: 'UPDATE', key: 'v5', value: 1 });
    sagaStore.dispatch({ type: 'CLOCK' });
  });

  // ─── xstate (machine with 5 context fields, CLOCK reads v1) ─────────────
  const xstateMachine = createMachine({
    types: {} as {
      events:
        | { type: 'UPDATE'; key: 'v1' | 'v2' | 'v3' | 'v4' | 'v5'; value: number }
        | { type: 'CLOCK' };
      context: { v1: number; v2: number; v3: number; v4: number; v5: number; acc: number };
    },
    context: { v1: 0, v2: 0, v3: 0, v4: 0, v5: 0, acc: 0 },
    on: {
      UPDATE: {
        actions: assign(({ context, event }) => ({
          ...context,
          [event.key]: event.value,
        })),
      },
      CLOCK: {
        actions: assign({
          acc: ({ context }) => context.acc + context.v1,
        }),
      },
    },
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: 'UPDATE', key: 'v1', value: 1 });
    xstateActor.send({ type: 'UPDATE', key: 'v2', value: 1 });
    xstateActor.send({ type: 'UPDATE', key: 'v3', value: 1 });
    xstateActor.send({ type: 'UPDATE', key: 'v4', value: 1 });
    xstateActor.send({ type: 'UPDATE', key: 'v5', value: 1 });
    xstateActor.send({ type: 'CLOCK' });
  });
});
