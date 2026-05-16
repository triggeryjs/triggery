# Triggery vs effector / rxjs / redux-saga / xstate

Side-by-side micro-benchmarks of the dispatch hot path against four libraries that occupy adjacent niches. Run them with `pnpm bench`; deterministic cycle counts live on [CodSpeed](https://codspeed.io/triggeryjs/triggery).

> These are **micro-benchmarks**. They measure the framework's per-event overhead, not real-app performance. In a real app render, network and store updates dominate. Treat the numbers as "is this library competitive in its hot path?", not "is it the fastest framework on earth?".

## Methodology

* Same business outcome per scenario; each library implemented idiomatically (effector via `sample`/`merge`, rxjs via `pipe`/`merge`, saga via `take*`, xstate via transitions/invoke).
* Bench fn does one logical unit per iteration. Setup happens once per `describe`.
* Counter is incremented in the handler so the work isn't optimised away.
* Source: `benchmarks/bench/comparisons/*.bench.ts`.
* `Triggery` uses the dev/test default (`inspector: on`). `Triggery (prod)` mirrors the production default (`createRuntime({ inspector: false })`) — same setup, no per-fire snapshot allocation or subscribe-listener fan-out. Devtools (`@triggery/devtools-redux`, `@triggery/devtools-bridge`, `useInspectHistory`) require the inspector to be on.

## Why rxjs is so fast on the simple scenarios

`Subject.next(value)` is essentially a for-loop over observers. Nothing else. When you compare against Triggery on a single subscriber, rxjs is 30× faster because for every fire Triggery also runs the inspector buffer, snapshot proxy, cascade context, abort-controller bookkeeping, and middleware chain — all features you didn't ask for at that call site but did get from the library design.

That's the trade. rxjs is a thin pub-sub; everything else (state, observability, cancellation) you build yourself. Triggery puts the observability + cascade safety + concurrency strategies on the dispatch hot path so you don't have to.

When scenarios pull in the things rxjs lacks (structured routing, scaling to many event types, paused/resumed reactions) the gap closes or flips. Scenarios 5, 6 and 8 pick examples where the library design — indexed dispatch, pull-only conditions, first-class enable/disable — pays off.

## Results

Local M1 Pro, Node 22, vitest 4.1, single-threaded. RME &lt; 5% on most rows; redux-saga is consistently noisier (~10%). Each row marks **winner overall** in bold; rows where Triggery beats most peers are flagged in the analysis.

### 1. Plain dispatch — event → action
One subscriber, one action, no conditions.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 16,900,000 | 28.3× |
| **xstate** | 691,000 | 1.16× |
| **Triggery (prod)** | 633,000 | 1.06× |
| **Triggery** | 598,000 | 1.00× |
| **redux-saga** | 418,000 | 0.70× |
| **effector** | 371,000 | 0.62× |

[`01-plain-dispatch.bench.ts`](./bench/comparisons/01-plain-dispatch.bench.ts)

### 2. Conditional dispatch — guard on every fire
Toggled boolean guard, 50% of events pass.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 13,400,000 | 24.0× |
| **xstate** | 1,030,000 | 1.85× |
| **Triggery (prod)** | 643,000 | 1.15× |
| **Triggery** | 558,000 | 1.00× |
| **effector** | 531,000 | 0.95× |
| **redux-saga** | 371,000 | 0.66× |

[`02-conditional.bench.ts`](./bench/comparisons/02-conditional.bench.ts)

### 3. Cascade — event A → handler → event B → handler
Both events fire synchronously in the same tick; counter is bumped only by B's handler.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 9,850,000 | 32.7× |
| **xstate** | 436,000 | 1.45× |
| **effector** | 358,000 | 1.19× |
| **Triggery (prod)** | 332,000 | 1.10× |
| **Triggery** | 301,000 | 1.00× |
| **redux-saga** | 222,000 | 0.74× |

[`03-cascade.bench.ts`](./bench/comparisons/03-cascade.bench.ts)

### 4. Take-latest — every fire cancels prior in-flight async work
Async handler awaits one microtask, then checks the cancel signal.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 4,110,000 | 14.3× |
| **redux-saga** | 355,000 | 1.24× |
| **Triggery (prod)** | 290,000 | 1.01× |
| **Triggery** | 287,000 | 1.00× |
| **effector** | 229,000 | 0.80× |
| **xstate** | 50,000 | 0.17× |

`prod` is flat here — microtask + Promise resolution dominates the per-iteration cost, so skipping the inspector buffer is in the noise.

[`04-take-latest.bench.ts`](./bench/comparisons/04-take-latest.bench.ts)

### 5. Sparse event bus — 100 event types, fire targets one
"Shared dispatcher routes typed events to typed handlers" — common in large apps. The fire hits one channel out of 100.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **effector** | 5,000,000 | 8.21× |
| **xstate** | 818,000 | 1.34× |
| **Triggery (prod)** | 689,000 | 1.13× |
| **Triggery** | 609,000 | 1.00× |
| **rxjs** | 358,000 | 0.59× |
| **redux-saga** | 329,000 | 0.54× |

🟢 Triggery's indexed `Map<eventName, Set<Trigger>>` stays O(1) on every fire. **We beat rxjs (shared `Subject` + 100 filters = O(N)) and saga (middleware + 100 takeEvery).** effector and xstate win this one because their per-event primitive is even tighter (each `createEvent` is its own minimal pub-sub; xstate's transitions are tabular lookup).

[`05-sparse-bus.bench.ts`](./bench/comparisons/05-sparse-bus.bench.ts)

### 6. Lazy conditions — 5 sources update each iter, handler reads 1
The runtime knows about 5 sources of state but the trigger only needs one of them in this branch of logic. Sources update on every iteration; the handler reads source #1.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 2,550,000 | 4.64× |
| **Triggery (prod)** | 629,000 | 1.15× |
| **Triggery** | 549,000 | 1.00× |
| **redux-saga** | 326,000 | 0.59× |
| **effector** | 217,000 | 0.40× |
| **xstate** | 126,000 | 0.23× |

🟢 Triggery's pull-only condition model treats source updates as plain variable writes — zero notify cost. **We beat effector, saga and xstate by 2-5×** because they all pay for state mutation per update (combine recomputes, reducer replaces state, assign builds new context). rxjs `BehaviorSubject` + `withLatestFrom` is essentially the same lazy strategy implemented through operators — replace it with `combineLatest` and rxjs joins us in the same range.

[`06-lazy-conditions.bench.ts`](./bench/comparisons/06-lazy-conditions.bench.ts)

### 7. Multi-event single trigger — one handler reacts to 5 event types
Common in real apps: one logical reaction listens to many event types (any of save/format/undo/redo bumps the auto-save debouncer).

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 14,400,000 | 24.5× |
| **effector** | 3,750,000 | 6.38× |
| **xstate** | 781,000 | 1.33× |
| **Triggery (prod)** | 663,000 | 1.13× |
| **Triggery** | 588,000 | 1.00× |
| **redux-saga** | 525,000 | 0.89× |

Mid-pack — `prod` keeps up with xstate's tabular lookup. Our `events: ['e1', ..., 'e5']` declaration is ergonomically nice (one trigger config vs `merge(...)` / array-of-types / 5 duplicated transitions). effector's `merge` and rxjs's `merge` still get optimised internally beyond what we do.

[`07-multi-event-trigger.bench.ts`](./bench/comparisons/07-multi-event-trigger.bench.ts)

### 8. Toggle enable/disable — every iter flips on/off, then fires
A trigger is bound to a feature flag that flips between renders. Each iteration: toggle, then fire. Half the fires are blocked, half pass through.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 6,500,000 | 6.19× |
| **Triggery (prod)** | 1,210,000 | 1.15× |
| **Triggery** | 1,050,000 | 1.00× |
| **effector** | 520,000 | 0.50× |
| **xstate** | 473,000 | 0.45× |
| **redux-saga** | 289,000 | 0.28× |

🟢 **Triggery wins #2 overall** (with `prod` widening the lead) — first-class `enable()` / `disable()` is a boolean flip. Every other library here has to fake "off" by either tearing down the subscription (rxjs/saga), gating via a store/guard (effector/xstate), or both. rxjs's `Subject.subscribe()` is fast enough to overtake us, but **we beat effector, xstate and saga by 2-4×**.

[`08-toggle.bench.ts`](./bench/comparisons/08-toggle.bench.ts)

## Where each library shines

| If you want… | Pick |
|---|---|
| Raw event throughput, one logical channel | **rxjs** (thin Subject + operators) |
| One channel + state machine semantics | **xstate** (transitions, guards, formal verification) |
| Many tight independent channels | **effector** (each event is its own pub-sub) |
| Generator-driven coordination + deep Redux | **redux-saga** (`takeLatest`/`takeEvery` are tight) |
| Shared dispatcher routing many event types | **Triggery** (indexed) or effector |
| Many state sources where a handler reads few | **Triggery** (pull-only) or rxjs `BehaviorSubject`+`withLatestFrom` |
| Async cancellation as a config knob | **Triggery** or `takeLatest` saga |
| **First-class enable/disable** as a feature-flag primitive | **Triggery** (the only one with built-in `trigger.enable()`/`disable()`) |
| Built-in observability/inspector/cascade safety with no wiring | **Triggery** (nothing else in this set ships it) |

We're not the fastest library on the smallest possible scenario. We're competitive across the board, beat the others where indexed dispatch, pull-only conditions, and first-class lifecycle match the workload, and pay a fixed overhead in exchange for the inspector, scope, cascade tracking and concurrency strategies that you'd otherwise build (and pay for) yourself.

## Reproducing

```bash
pnpm install
pnpm bench
```

Numbers fluctuate on busy machines. For deterministic comparison, push the change and watch the CodSpeed dashboard.
