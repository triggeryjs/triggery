# Triggery vs effector / rxjs / redux-saga / xstate / Reatom / MobX

> **Not an event emitter. Not a state manager. Triggery orchestrates business logic across your app.** Each library on this page solves a different primary job — pub/sub, state, side-effect coordination, machines, atomic state, observable state. This page is "if you used X to do the orchestration job Triggery does, how much would each fire cost?" It is not "X is better/worse than Y at the thing X was built for."

Side-by-side micro-benchmarks of the dispatch hot path against six neighbour libraries. Run them with `pnpm bench`; deterministic cycle counts live on [CodSpeed](https://codspeed.io/triggeryjs/triggery).

> These are **micro-benchmarks**. They measure the framework's per-event overhead, not real-app performance. In a real app render, network and store updates dominate. Treat the numbers as "is this library competitive in its hot path?", not "is it the fastest framework on earth?".

## Methodology

* Same business outcome per scenario; each library implemented idiomatically:
  * effector via `sample`/`merge`
  * rxjs via `pipe`/`merge`/`Subject`
  * saga via `take*` effects
  * xstate via transitions / invoke / `assign`
  * Reatom via `action()` + `atom()` + `onCall()`
  * MobX via `observable` + `reaction()` / `autorun()`
* Bench fn does one logical unit per iteration. Setup happens once per `describe`.
* Counter is incremented in the handler so the work isn't optimised away.
* Source: `benchmarks/bench/vs/*.bench.ts`.
* `Triggery` uses the dev/test default (`inspector: on`). `Triggery (prod)` mirrors the production default (`createRuntime({ inspector: false })`) — same setup, no per-fire snapshot allocation or subscribe-listener fan-out. Devtools (`@triggery/devtools-redux`, `@triggery/devtools-bridge`, `useInspectHistory`) require the inspector to be on.

## Why the signal/observable libs win raw throughput

`Subject.next(value)` (rxjs), `atom.set(...)` (Reatom), `box.set(...)` (MobX) — these are bare reactive primitives: a for-loop over observers, or a single dependency-graph mark-and-sweep. Nothing else. When you compare against Triggery on a single subscriber, rxjs is 30× faster because for every fire Triggery also runs the inspector buffer, snapshot proxy, cascade context, abort-controller bookkeeping, and middleware chain — all features you didn't ask for at that call site but did get from the library design. Reatom and MobX land 4-8× ahead for the same reason: their primary job is "mutate state, fire reactions", optimised to the bone.

That's the trade. Pub/sub libs and signal libs are thin reactive primitives; everything else (orchestration, observability, cascade safety, cancellation, scope isolation) you build yourself. Triggery puts the observability + cascade safety + concurrency strategies + first-class lifecycle on the dispatch hot path so you don't have to.

When scenarios pull in the things those libs lack natively — structured routing, scaling to many event types, paused/resumed reactions, gated dispatch over many subscribers — the gap closes or flips. Scenarios 5, 6, 8 and 10 pick examples where the library design — indexed dispatch, pull-only conditions, first-class enable/disable — pays off. Even there Triggery typically trades places with the signal libs rather than dominating them; the win is against the legacy effect libraries (effector for non-signal use, saga, xstate).

## Results

Local M1 Pro, Node 22, vitest 4.1, single-threaded. RME &lt; 5% on most rows; redux-saga is consistently noisier (~10%). Each row marks **winner overall** in bold; rows where Triggery beats most peers are flagged in the analysis.

### 1. Plain dispatch — event → action
One subscriber, one action, no conditions.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 16,800,000 | 27.1× |
| **reatom** | 3,780,000 | 6.10× |
| **mobx** | 3,020,000 | 4.87× |
| **xstate** | 675,000 | 1.09× |
| **Triggery (prod)** | 606,000 | 0.98× |
| **Triggery** | 620,000 | 1.00× |
| **redux-saga** | 428,000 | 0.69× |
| **effector** | 370,000 | 0.60× |

[`01-plain-dispatch.bench.ts`](./bench/vs/01-plain-dispatch.bench.ts)

### 2. Conditional dispatch — guard on every fire
Toggled boolean guard, 50% of events pass.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 14,500,000 | 25.6× |
| **reatom** | 4,450,000 | 7.86× |
| **mobx** | 3,240,000 | 5.72× |
| **xstate** | 1,290,000 | 2.28× |
| **Triggery (prod)** | 649,000 | 1.15× |
| **Triggery** | 566,000 | 1.00× |
| **effector** | 566,000 | 1.00× |
| **redux-saga** | 484,000 | 0.86× |

[`02-conditional.bench.ts`](./bench/vs/02-conditional.bench.ts)

### 3. Cascade — event A → handler → event B → handler
Both events fire synchronously in the same tick; counter is bumped only by B's handler.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 9,910,000 | 47.9× |
| **reatom** | 5,100,000 | 24.7× |
| **mobx** | 1,600,000 | 7.75× |
| **xstate** | 429,000 | 2.07× |
| **effector** | 356,000 | 1.72× |
| **Triggery (prod)** | 335,000 | 1.62× |
| **Triggery** | 207,000 | 1.00× |
| **redux-saga** | 202,000 | 0.98× |

Cascade is Triggery's heaviest pattern: every fire pays the full dispatch overhead, and a 2-level cascade pays it twice. The signal libs (Reatom, MobX) treat A→B as a simple chained mutation that the scheduler batches, so they fly. We pay for the cascade-context bookkeeping you'd otherwise have to write yourself.

[`03-cascade.bench.ts`](./bench/vs/03-cascade.bench.ts)

### 4. Take-latest — every fire cancels prior in-flight async work
Async handler awaits one microtask, then checks the cancel signal.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 4,160,000 | 14.8× |
| **reatom** | 3,320,000 | 11.9× |
| **mobx** | 497,000 | 1.78× |
| **redux-saga** | 381,000 | 1.36× |
| **Triggery (prod)** | 301,000 | 1.07× |
| **Triggery** | 280,000 | 1.00× |
| **effector** | 226,000 | 0.81× |
| **xstate** | 50,000 | 0.18× |

`prod` is flat here — microtask + Promise resolution dominates the per-iteration cost, so skipping the inspector buffer is in the noise. Reatom and MobX implementations use a manual AbortController per mutation, same pattern as effector, so the "native" tier here is just rxjs `switchMap` and saga `takeLatest`; everyone else (us included) builds it.

[`04-take-latest.bench.ts`](./bench/vs/04-take-latest.bench.ts)

### 5. Sparse event bus — 100 event types, fire targets one
"Shared dispatcher routes typed events to typed handlers" — common in large apps. The fire hits one channel out of 100.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **reatom** | 5,070,000 | 8.30× |
| **effector** | 5,050,000 | 8.27× |
| **mobx** | 2,940,000 | 4.81× |
| **xstate** | 795,000 | 1.30× |
| **Triggery (prod)** | 690,000 | 1.13× |
| **Triggery** | 611,000 | 1.00× |
| **rxjs** | 388,000 | 0.63× |
| **redux-saga** | 327,000 | 0.54× |

🟢 Triggery's indexed `Map<eventName, Set<Trigger>>` stays O(1) on every fire. **We beat rxjs (shared `Subject` + 100 filters = O(N)) and saga (middleware + 100 takeEvery).** Reatom, effector, MobX and xstate win this one because their per-event primitive is even tighter: each atom / event / observable / transition is its own minimal pub-sub, and "routing" is just identity dispatch.

[`05-sparse-bus.bench.ts`](./bench/vs/05-sparse-bus.bench.ts)

### 6. Lazy conditions — 5 sources update each iter, handler reads 1
The runtime knows about 5 sources of state but the trigger only needs one of them in this branch of logic. Sources update on every iteration; the handler reads source #1.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 2,450,000 | 4.16× |
| **mobx** | 2,000,000 | 3.40× |
| **reatom** | 1,190,000 | 2.02× |
| **Triggery (prod)** | 659,000 | 1.12× |
| **Triggery** | 589,000 | 1.00× |
| **redux-saga** | 316,000 | 0.54× |
| **effector** | 212,000 | 0.36× |
| **xstate** | 122,000 | 0.21× |

🟢 Triggery's pull-only condition model treats source updates as plain variable writes — zero notify cost. **We beat effector, saga and xstate by 3-5×** because they all pay for state mutation per update (combine recomputes, reducer replaces state, assign builds new context). rxjs `BehaviorSubject` + `withLatestFrom`, MobX `reaction` and Reatom `atom.subscribe` use the same lazy strategy through their own primitives and stay ahead — those are signal libs built to do this, while Triggery layers it on top of an orchestrator.

[`06-lazy-conditions.bench.ts`](./bench/vs/06-lazy-conditions.bench.ts)

### 7. Multi-event single trigger — one handler reacts to 5 event types
Common in real apps: one logical reaction listens to many event types (any of save/format/undo/redo bumps the auto-save debouncer).

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 14,300,000 | 23.3× |
| **effector** | 3,750,000 | 6.11× |
| **reatom** | 3,090,000 | 5.03× |
| **mobx** | 2,480,000 | 4.04× |
| **Triggery (prod)** | 694,000 | 1.13× |
| **xstate** | 636,000 | 1.04× |
| **Triggery** | 614,000 | 1.00× |
| **redux-saga** | 410,000 | 0.67× |

Mid-pack — `prod` keeps up with xstate's tabular lookup, both ahead of saga. Our `events: ['e1', ..., 'e5']` declaration is ergonomically nice (one trigger config vs `merge(...)` / array-of-types / 5 duplicated transitions / 5 atoms/observables sharing a callback). effector's `merge`, rxjs's `merge` and the per-atom subscribe patterns of Reatom/MobX still get optimised internally beyond what we do.

[`07-multi-event-trigger.bench.ts`](./bench/vs/07-multi-event-trigger.bench.ts)

### 8. Toggle enable/disable — every iter flips on/off, then fires
A trigger is bound to a feature flag that flips between renders. Each iteration: toggle, then fire. Half the fires are blocked, half pass through.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 6,480,000 | 6.17× |
| **reatom** | 2,810,000 | 2.68× |
| **mobx** | 2,350,000 | 2.24× |
| **Triggery (prod)** | 1,210,000 | 1.15× |
| **Triggery** | 1,050,000 | 1.00× |
| **effector** | 528,000 | 0.50× |
| **xstate** | 474,000 | 0.45× |
| **redux-saga** | 302,000 | 0.29× |

🟢 First-class `enable()` / `disable()` is a boolean flip. effector / xstate / saga have to fake "off" by tearing down a subscription, gating via a store/guard, or cancelling a task — and we beat all three by **2-4×**. rxjs's `Subject.subscribe()` plus Reatom / MobX's bare reaction overhead get them ahead on this exact shape, but the architectural point — disable is a flag, not a subscription tear-down — still stands for the legacy effect libs.

[`08-toggle.bench.ts`](./bench/vs/08-toggle.bench.ts)

### 9. Realistic app bus — 30 events × 30 triggers, each with condition + action
The shape of a real medium app: 30 distinct event types, each with one trigger that gates on a required condition (`flag`), reads a second condition (`factor`) and dispatches an action. Bench rotates through all 30 events so every fire takes a different route.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **reatom** | 4,260,000 | 8.45× |
| **mobx** | 3,000,000 | 5.95× |
| **rxjs** | 1,290,000 | 2.56× |
| **xstate** | 703,000 | 1.39× |
| **Triggery (prod)** | 586,000 | 1.16× |
| **Triggery** | 504,000 | 1.00× |
| **redux-saga** | 440,000 | 0.87× |
| **effector** | 361,000 | 0.72× |

Mid-pack against the legacy effect libs (we beat effector and saga), behind the signal/observable tier (Reatom, MobX, rxjs, xstate). The bench combines three Triggery hot-path advantages — indexed routing, required-gate, pull-only conditions — into one realistic shape; it's a useful proof that the combined per-fire cost stays competitive when no single advantage dominates, but the per-event reactive primitives in Reatom/MobX are still tighter than our dispatch pipeline.

[`09-realistic-bus.bench.ts`](./bench/vs/09-realistic-bus.bench.ts)

### 10. Lazy conditions at scale — 10 sources update each iter, handler reads 1 rotating
Scaled-up version of scenario 6. The runtime knows about 10 sources, all mutated on every iteration ("source churn"), but the handler reads only ONE — and which one rotates between iters based on `event.payload % 10`.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **mobx** | 1,630,000 | 2.96× |
| **rxjs** | 1,430,000 | 2.60× |
| **reatom** | 634,000 | 1.15× |
| **Triggery (prod)** | 625,000 | 1.13× |
| **Triggery** | 551,000 | 1.00× |
| **redux-saga** | 310,000 | 0.56× |
| **effector** | 160,000 | 0.29× |
| **xstate** | 72,000 | 0.13× |

🟢 Scenario 6's story, intensified. Triggery's pull-only conditions treat source updates as plain variable writes — zero notify cost — so the 10 source mutations per iter cost almost nothing, and the handler's one Proxy read is the entire work. **We beat effector by 3.4×, saga by 1.8×, xstate by 7.7×.** effector's `combine` recomputes the 10-store snapshot on every update; xstate's `assign` rebuilds context; saga reducer copies state. The signal libs (MobX, rxjs `BehaviorSubject` + `withLatestFrom`, Reatom) use the same lazy strategy through their own primitives — MobX and rxjs stay ahead, Reatom lands essentially tied with `prod` here because its scheduler debounces the 10 atom.set calls into one tick.

[`10-lazy-at-scale.bench.ts`](./bench/vs/10-lazy-at-scale.bench.ts)

## Where each library shines

| If you want… | Pick |
|---|---|
| Raw event throughput, one logical channel | **rxjs** (thin Subject + operators) |
| Auto-tracking observable state with reactions | **MobX** (`observable` + `reaction` / `autorun`) |
| Atomic signal-based state, signal/computed/effect | **Reatom** (`atom` + `computed` + `effect`) |
| One channel + state machine semantics | **xstate** (transitions, guards, formal verification) |
| Many tight independent channels | **effector** (each event is its own pub-sub) |
| Generator-driven coordination + deep Redux | **redux-saga** (`takeLatest`/`takeEvery` are tight) |
| Shared dispatcher routing many event types | **Triggery** (indexed), effector or Reatom (per-atom dispatch) |
| Many state sources where a handler reads few | **Triggery** (pull-only), rxjs `BehaviorSubject`+`withLatestFrom`, or MobX `reaction` |
| Async cancellation as a config knob | **Triggery** or `takeLatest` saga |
| **First-class enable/disable** as a feature-flag primitive | **Triggery** (the only one with built-in `trigger.enable()`/`disable()`) |
| Built-in observability/inspector/cascade safety with no wiring | **Triggery** (nothing else in this set ships it) |
| **Orchestrating business logic across an existing stack** | **Triggery** (sits on top of any store, not a replacement for one) |

We're not the fastest library on the smallest possible scenario — and we're not trying to be one. The signal/observable libs (rxjs, Reatom, MobX) out-throughput us on bare per-fire cost because that's their entire job; we're 30-50× slower than rxjs on a single `Subject.next` for the same reason a saw is slower than a router bit on the table. Triggery is the table: orchestration, observability, scope, cascade safety, first-class lifecycle — paid as a fixed per-fire overhead so you don't write it yourself.

## Reproducing

```bash
pnpm install
pnpm bench
```

Numbers fluctuate on busy machines. For deterministic comparison, push the change and watch the CodSpeed dashboard.
