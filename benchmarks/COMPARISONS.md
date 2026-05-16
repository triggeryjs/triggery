# Triggery vs effector / rxjs / redux-saga / xstate

Side-by-side micro-benchmarks of the dispatch hot path against four libraries that occupy adjacent niches. Run them with `pnpm bench`; deterministic cycle counts live on [CodSpeed](https://codspeed.io/triggeryjs/triggery).

> These are **micro-benchmarks**. They measure the framework's per-event overhead, not real-app performance. In a real app render, network and store updates dominate. Treat the numbers as "is this library competitive in its hot path?", not "is it the fastest framework on earth?".

## Methodology

* Same business outcome per scenario; each library implemented idiomatically (effector via `sample`, rxjs via `pipe`, saga via `take*`, xstate via transitions/invoke).
* Bench fn does one dispatch per iteration. Setup happens once per `describe`.
* Counter is incremented in the handler so the work isn't optimised away.
* Source: `benchmarks/bench/comparisons/*.bench.ts`.

## Results

Local M1 Pro, Node 22, vitest 4.1, single-threaded. RME (relative margin of error) shown to gauge noise — anything &lt; 5% is solid. CodSpeed gives the Linux-Valgrind deterministic counterpart.

### 1. Plain dispatch — event → action
One subscriber, one action, no conditions.

| Library | ops/sec | relative to Triggery |
|---|---:|---:|
| **rxjs** | 16,400,000 | 32.5× |
| **xstate** | 614,000 | 1.22× |
| **Triggery** | 505,000 | 1.00× |
| **redux-saga** | 442,000 | 0.87× |
| **effector** | 358,000 | 0.71× |

[`01-plain-dispatch.bench.ts`](./bench/comparisons/01-plain-dispatch.bench.ts)

### 2. Conditional dispatch — guard on every fire
Toggled boolean guard, 50% of events pass.

| Library | ops/sec | relative to Triggery |
|---|---:|---:|
| **rxjs** | 14,300,000 | 27.8× |
| **xstate** | 999,000 | 1.94× |
| **effector** | 565,000 | 1.09× |
| **Triggery** | 516,000 | 1.00× |
| **redux-saga** | 456,000 | 0.88× |

[`02-conditional.bench.ts`](./bench/comparisons/02-conditional.bench.ts)

### 3. Cascade — event A → handler → event B → handler
Both events fire synchronously in the same tick; counter is bumped only by B's handler.

| Library | ops/sec | relative to Triggery |
|---|---:|---:|
| **rxjs** | 9,450,000 | 38.0× |
| **xstate** | 423,000 | 1.70× |
| **effector** | 343,000 | 1.38× |
| **Triggery** | 249,000 | 1.00× |
| **redux-saga** | 206,000 | 0.83× |

[`03-cascade.bench.ts`](./bench/comparisons/03-cascade.bench.ts)

### 4. Take-latest — every fire cancels prior in-flight async work
Async handler awaits one microtask, then checks the cancel signal.

| Library | ops/sec | relative to Triggery |
|---|---:|---:|
| **rxjs** | 4,010,000 | 13.1× |
| **redux-saga** | 383,000 | 1.25× |
| **Triggery** | 307,000 | 1.00× |
| **effector** | 228,000 | 0.74× |
| **xstate** | 50,000 | 0.16× |

[`04-take-latest.bench.ts`](./bench/comparisons/04-take-latest.bench.ts)

## How to read this

**rxjs is fastest across the board.** It's a thin `Subject` + operator chain, no graph, no observability, no cascade tracking. If you want maximum throughput and accept the rxjs mental model, you'll beat every framework here.

**Triggery sits middle-of-pack on the simple scenarios.** Within ~25% of effector, xstate, redux-saga. The overhead we pay vs a plain Subject is mostly observability (inspector buffer, snapshot proxy) and cascade tracking (visited chain, depth check) on every fire. Those are paid features — you get them whether or not you opt in.

**Take-latest is where built-in concurrency strategies pull weight.** We beat effector (which needs a manual AbortController wrapper) and xstate (which leans on `invoke` re-entry — heavy). redux-saga's dedicated `takeLatest` effect is a hair faster than ours. rxjs's `switchMap` is the king here.

**Cascade is our weak spot.** We pay for cycle detection + depth guard on every nested fire. effector's `forward` is just a synchronous edge, so it's ~40% faster. If you don't use cascade, the cost is still there in dispatch — a candidate for V1.1 to make optional.

## When each library wins

| If you want… | Pick |
|---|---|
| Maximum raw event throughput, FRP mental model | **rxjs** |
| Hard state machines, statecharts, formal verification | **xstate** |
| Generator-driven side-effects, deep Redux integration | **redux-saga** |
| Reactive stores + events + effects as a unified graph | **effector** |
| Hook-first business logic in one file with built-in observability, scoping, cascade safety, concurrency strategies, all working together | **Triggery** |

## Reproducing

```bash
pnpm install
pnpm bench
```

Numbers fluctuate on busy machines. For deterministic comparison, push the change and watch the CodSpeed dashboard.
