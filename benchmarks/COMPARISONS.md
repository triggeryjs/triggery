# Triggery vs effector / rxjs / redux-saga / xstate

Side-by-side micro-benchmarks of the dispatch hot path against four libraries that occupy adjacent niches. Run them with `pnpm bench`; deterministic cycle counts live on [CodSpeed](https://codspeed.io/triggeryjs/triggery).

> These are **micro-benchmarks**. They measure the framework's per-event overhead, not real-app performance. In a real app render, network and store updates dominate. Treat the numbers as "is this library competitive in its hot path?", not "is it the fastest framework on earth?".

## Methodology

* Same business outcome per scenario; each library implemented idiomatically (effector via `sample`/`merge`, rxjs via `pipe`/`merge`, saga via `take*`, xstate via transitions/invoke).
* Bench fn does one logical unit per iteration. Setup happens once per `describe`.
* Counter is incremented in the handler so the work isn't optimised away.
* Source: `benchmarks/bench/comparisons/*.bench.ts`.

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
| **rxjs** | 16,400,000 | 32.5× |
| **xstate** | 614,000 | 1.22× |
| **Triggery** | 505,000 | 1.00× |
| **redux-saga** | 442,000 | 0.87× |
| **effector** | 358,000 | 0.71× |

[`01-plain-dispatch.bench.ts`](./bench/comparisons/01-plain-dispatch.bench.ts)

### 2. Conditional dispatch — guard on every fire
Toggled boolean guard, 50% of events pass.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 14,300,000 | 27.8× |
| **xstate** | 999,000 | 1.94× |
| **effector** | 565,000 | 1.09× |
| **Triggery** | 516,000 | 1.00× |
| **redux-saga** | 456,000 | 0.88× |

[`02-conditional.bench.ts`](./bench/comparisons/02-conditional.bench.ts)

### 3. Cascade — event A → handler → event B → handler
Both events fire synchronously in the same tick; counter is bumped only by B's handler.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 9,450,000 | 38.0× |
| **xstate** | 423,000 | 1.70× |
| **effector** | 343,000 | 1.38× |
| **Triggery** | 249,000 | 1.00× |
| **redux-saga** | 206,000 | 0.83× |

[`03-cascade.bench.ts`](./bench/comparisons/03-cascade.bench.ts)

### 4. Take-latest — every fire cancels prior in-flight async work
Async handler awaits one microtask, then checks the cancel signal.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 4,010,000 | 13.1× |
| **redux-saga** | 383,000 | 1.25× |
| **Triggery** | 307,000 | 1.00× |
| **effector** | 228,000 | 0.74× |
| **xstate** | 50,000 | 0.16× |

[`04-take-latest.bench.ts`](./bench/comparisons/04-take-latest.bench.ts)

### 5. Sparse event bus — 100 event types, fire targets one
"Shared dispatcher routes typed events to typed handlers" — common in large apps. The fire hits one channel out of 100.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **effector** | 5,180,000 | 9.51× |
| **xstate** | 757,000 | 1.39× |
| **Triggery** | 544,000 | 1.00× |
| **rxjs** | 286,000 | 0.53× |
| **redux-saga** | 251,000 | 0.46× |

🟢 Triggery's indexed `Map<eventName, Set<Trigger>>` stays O(1) on every fire. **We beat rxjs (shared `Subject` + 100 filters = O(N)) and saga (middleware + 100 takeEvery) by ~2×.** effector and xstate win this one because their per-event primitive is even tighter (each `createEvent` is its own minimal pub-sub; xstate's transitions are tabular lookup).

[`05-sparse-bus.bench.ts`](./bench/comparisons/05-sparse-bus.bench.ts)

### 6. Lazy conditions — 5 sources update each iter, handler reads 1
The runtime knows about 5 sources of state but the trigger only needs one of them in this branch of logic. Sources update on every iteration; the handler reads source #1.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 2,570,000 | 4.98× |
| **Triggery** | 517,000 | 1.00× |
| **redux-saga** | 302,000 | 0.58× |
| **effector** | 212,000 | 0.41× |
| **xstate** | 127,000 | 0.25× |

🟢 Triggery's pull-only condition model treats source updates as plain variable writes — zero notify cost. **We beat effector, saga and xstate** because they all pay for state mutation per update (combine recomputes, reducer replaces state, assign builds new context). rxjs `BehaviorSubject` + `withLatestFrom` is essentially the same lazy strategy implemented through operators — replace it with `combineLatest` and rxjs joins us in the same range.

[`06-lazy-conditions.bench.ts`](./bench/comparisons/06-lazy-conditions.bench.ts)

### 7. Multi-event single trigger — one handler reacts to 5 event types
Common in real apps: one logical reaction listens to many event types (any of save/format/undo/redo bumps the auto-save debouncer).

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 14,450,000 | 26.5× |
| **effector** | 3,740,000 | 6.87× |
| **xstate** | 814,000 | 1.49× |
| **Triggery** | 545,000 | 1.00× |
| **redux-saga** | 569,000 | 1.05× |

Mid-pack. Our `events: ['e1', ..., 'e5']` declaration is ergonomically nice (one trigger config vs `merge(...)` / array-of-types / 5 duplicated transitions), but it doesn't translate to a perf win — the same fixed dispatch overhead applies on each fire. effector's `merge` and rxjs's `merge` get optimised internally; xstate's tabular lookup is also tight.

[`07-multi-event-trigger.bench.ts`](./bench/comparisons/07-multi-event-trigger.bench.ts)

### 8. Toggle enable/disable — every iter flips on/off, then fires
A trigger is bound to a feature flag that flips between renders. Each iteration: toggle, then fire. Half the fires are blocked, half pass through.

| Library | ops/sec | vs Triggery |
|---|---:|---:|
| **rxjs** | 6,570,000 | 6.71× |
| **Triggery** | 979,000 | 1.00× |
| **effector** | 523,000 | 0.53× |
| **xstate** | 462,000 | 0.47× |
| **redux-saga** | 341,000 | 0.35× |

🟢 **Triggery wins #2 overall** — first-class `enable()` / `disable()` is a boolean flip. Every other library here has to fake "off" by either tearing down the subscription (rxjs/saga), gating via a store/guard (effector/xstate), or both. rxjs's `Subject.subscribe()` is fast enough to overtake us, but **we beat effector, xstate and saga by 2-3×**.

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
