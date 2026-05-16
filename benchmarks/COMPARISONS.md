# Triggery vs effector / rxjs / redux-saga / xstate

Side-by-side micro-benchmarks of the dispatch hot path against four libraries that occupy adjacent niches. Run them with `pnpm bench`; deterministic cycle counts live on [CodSpeed](https://codspeed.io/triggeryjs/triggery).

> These are **micro-benchmarks**. They measure the framework's per-event overhead, not real-app performance. In a real app render, network and store updates dominate. Treat the numbers as "is this library competitive in its hot path?", not "is it the fastest framework on earth?".

## Methodology

* Same business outcome per scenario; each library implemented idiomatically (effector via `sample`, rxjs via `pipe`, saga via `take*`, xstate via transitions/invoke).
* Bench fn does one logical unit per iteration. Setup happens once per `describe`.
* Counter is incremented in the handler so the work isn't optimised away.
* Source: `benchmarks/bench/comparisons/*.bench.ts`.

## Why rxjs is so fast on simple scenarios

`Subject.next(value)` is essentially a for-loop over observers. Nothing else. When you compare against Triggery on a single subscriber, rxjs is 30× faster because for every fire Triggery also runs the inspector buffer, snapshot proxy, cascade context, abort-controller bookkeeping, and middleware chain — all features you didn't ask for at that call site but did get from the library design.

That's the trade. rxjs is a thin pub-sub; everything else (state, observability, cancellation) you build yourself. Triggery puts the observability + cascade safety + concurrency strategies on the dispatch hot path so you don't have to.

When scenarios pull in the things rxjs lacks (state, structured routing, scaling to many event types) the gap closes or flips. Scenarios 5 and 6 below pick examples where the library design — indexed dispatch and pull-only conditions — pays off.

## Results

Local M1 Pro, Node 22, vitest 4.1, single-threaded. RME &lt; 5% on most rows; redux-saga is consistently noisier (~10%).

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

This is where indexed dispatch matters. effector and xstate beat us because their per-event primitive is even tighter (each `createEvent` is its own minimal pub-sub; xstate transitions are a tabular lookup). But **we beat rxjs and redux-saga** by ~2× — the shared-bus + filter-chain pattern (or saga's middleware + 100 `takeEvery`) pays O(N) per fire, while our `Map<eventName, Set<Trigger>>` stays O(1). If you've ever felt your rxjs event bus get sluggish as you added more channels, this is why.

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

Triggery's pull-only condition model treats source updates as plain variable writes — zero notify cost. **effector, saga and xstate all pay for state mutation per update** (combine recomputes, reducer replaces state, assign builds a new context). The hottest implementations beat us only because they avoid push-propagation: rxjs `BehaviorSubject` + `withLatestFrom` is essentially the same lazy strategy we use natively, implemented through operators. If you take that off the table (use `combineLatest` or eager `scan`), rxjs joins us in the same range.

[`06-lazy-conditions.bench.ts`](./bench/comparisons/06-lazy-conditions.bench.ts)

## How to read this together

| Where each library shines | |
|---|---|
| Raw event throughput, one logical channel | rxjs (thin Subject) |
| One logical channel, state machines | xstate |
| Many tight independent channels | effector |
| Generator-driven coordination with deep Redux | redux-saga |
| Shared dispatcher routing many event types | **Triggery** (indexed) or effector |
| Many state sources where a handler reads few | **Triggery** (pull-only) or rxjs `BehaviorSubject`+`withLatestFrom` |
| Async cancellation as a config knob, not as plumbing | **Triggery** or redux-saga `takeLatest` |
| Built-in observability/inspector/cascade safety with no extra wiring | **Triggery** (nothing else in this set ships it) |

We're not the fastest library on the smallest possible scenario. We're competitive across the board, beat the others where indexed dispatch and pull-only conditions match the workload, and pay a fixed overhead in exchange for the inspector, scope, cascade tracking and concurrency strategies that you'd otherwise build (and pay for) yourself.

## Reproducing

```bash
pnpm install
pnpm bench
```

Numbers fluctuate on busy machines. For deterministic comparison, push the change and watch the CodSpeed dashboard.
