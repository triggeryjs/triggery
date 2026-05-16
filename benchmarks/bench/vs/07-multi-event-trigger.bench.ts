/**
 * Scenario 7 — one logical reaction listens to many event types.
 *
 * Common in real apps: "anything that touches the current document — save,
 * format, undo, redo — should debounce the auto-saver". One handler, many
 * triggers. The bench rotates through 5 event types and counts dispatch
 * throughput.
 *
 * Each library expresses fan-in idiomatically:
 *   - Triggery: ONE `createTrigger` listing all 5 events
 *   - effector: `merge([e1, ..., e5]).watch(handler)`
 *   - rxjs: `merge(s1, ..., s5).subscribe(handler)`
 *   - redux-saga: `takeEvery([t1, ..., t5], handler)`
 *   - xstate: 5 transitions in `on:` all pointing at the same action
 *
 * Triggery's `events: [...]` declaration creates one entry per event in the
 * indexed dispatch — so each fire hits the registry once, walks a 1-element
 * Set, and runs the same handler. No `merge` operator needed, no derived
 * unit, no transition table duplication.
 */

import { createRuntime, createTrigger } from '@triggery/core';
import { createEvent, merge } from 'effector';
import { applyMiddleware, createStore as createReduxStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { takeEvery } from 'redux-saga/effects';
import { merge as rxMerge, Subject } from 'rxjs';
import { bench, describe } from 'vitest';
import { assign, createActor, createMachine } from 'xstate';

const EVENT_NAMES = ['e1', 'e2', 'e3', 'e4', 'e5'] as const;
type EventName = (typeof EVENT_NAMES)[number];

describe('comparison — one trigger reacts to 5 event types (rotating fires)', () => {
  let tick = 0;
  const nextEvent = (): EventName => {
    const name = EVENT_NAMES[tick % EVENT_NAMES.length] as EventName;
    tick++;
    return name;
  };

  // ─── Triggery (default) ──────────────────────────────────────────────────
  const triggeryAcc = { n: 0 };
  const tRuntime = createRuntime();
  createTrigger<{ events: Record<EventName, number> }>(
    {
      id: 'multi',
      events: EVENT_NAMES,
      handler: ({ event }) => {
        triggeryAcc.n += event.payload;
      },
    },
    tRuntime,
  );
  bench('triggery', () => {
    tRuntime.fireSync(nextEvent(), 1);
  });

  // ─── Triggery (prod) ─────────────────────────────────────────────────────
  const tProdAcc = { n: 0 };
  const tProdRuntime = createRuntime({ inspector: false });
  createTrigger<{ events: Record<EventName, number> }>(
    {
      id: 'multi-prod',
      events: EVENT_NAMES,
      handler: ({ event }) => {
        tProdAcc.n += event.payload;
      },
    },
    tProdRuntime,
  );
  bench('triggery (prod)', () => {
    tProdRuntime.fireSync(nextEvent(), 1);
  });

  // ─── effector (merge into one derived unit) ──────────────────────────────
  const effectorAcc = { n: 0 };
  const eEvents = EVENT_NAMES.map(() => createEvent<number>());
  const eMerged = merge(eEvents);
  eMerged.watch((n) => {
    effectorAcc.n += n;
  });
  bench('effector', () => {
    const i = tick % EVENT_NAMES.length;
    tick++;
    eEvents[i]?.(1);
  });

  // ─── rxjs (5 Subjects + merge operator) ──────────────────────────────────
  const rxjsAcc = { n: 0 };
  const subjects = EVENT_NAMES.map(() => new Subject<number>());
  rxMerge(...subjects).subscribe((n) => {
    rxjsAcc.n += n;
  });
  bench('rxjs', () => {
    const i = tick % EVENT_NAMES.length;
    tick++;
    subjects[i]?.next(1);
  });

  // ─── redux-saga (takeEvery with an array of types) ───────────────────────
  const sagaAcc = { n: 0 };
  const sagaMw = createSagaMiddleware();
  const sagaStore = createReduxStore((s = 0) => s, applyMiddleware(sagaMw));
  sagaMw.run(function* () {
    yield takeEvery([...EVENT_NAMES], function* (action: { type: string; payload: number }) {
      sagaAcc.n += action.payload;
      yield;
    });
  });
  bench('redux-saga', () => {
    sagaStore.dispatch({ type: nextEvent(), payload: 1 });
  });

  // ─── xstate (5 transitions, same action) ─────────────────────────────────
  const xstateOn: Record<string, { actions: ReturnType<typeof assign> }> = {};
  for (const name of EVENT_NAMES) {
    xstateOn[name] = {
      actions: assign({
        // biome-ignore lint/suspicious/noExplicitAny: payload type varies
        acc: ({ context, event }: any) => context.acc + event.payload,
      }),
    };
  }
  const xstateMachine = createMachine({
    context: { acc: 0 },
    // biome-ignore lint/suspicious/noExplicitAny: dynamic on-table
    on: xstateOn as any,
  });
  const xstateActor = createActor(xstateMachine).start();
  bench('xstate', () => {
    xstateActor.send({ type: nextEvent(), payload: 1 });
  });
});
