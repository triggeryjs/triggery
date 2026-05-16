# @triggery/core

The runtime that powers [Triggery](https://github.com/triggeryjs/triggery) — a declarative `event → conditions → actions` orchestration layer.

**Framework-agnostic.** `@triggery/core` itself has **zero runtime dependencies** and knows nothing about React, Solid or Vue. The framework bindings (`@triggery/react`, `@triggery/solid`, `@triggery/vue`) and the state adapters are thin layers on top of this runtime — and they can be replaced by anything you author yourself in ~50 lines.

## Install

```bash
pnpm add @triggery/core
# plus your framework binding of choice
pnpm add @triggery/react   # or @triggery/solid, @triggery/vue
```

## What's in the box

- `createTrigger<Schema>(config)` — declare a scenario in one file (events, conditions, required gate, handler).
- `createRuntime(options)` — instantiate an isolated runtime: indexed dispatch (`Map<eventKey, RuntimeTrigger[]>`), microtask + sync schedulers, middleware chain (`onFire` / `onBeforeMatch` / `onSkip` / `onActionStart` / `onActionEnd` / `onError` / `onCascade`), cascade safety (depth limit + cycle detection), inspector ring buffer with DEV/PROD auto-detection.
- `getDefaultRuntime()` / `setDefaultRuntime()` — global singleton for apps that don't want explicit provider wiring.
- Concurrency strategies for async handlers (`take-latest` / `take-every` / `take-first` / `queue` / `exhaust` / `sync`) with `AbortSignal`.
- `actions.debounce / throttle / defer / queue` chainable action wrappers.
- Last-mount-wins ownership with DEV warn-once.

You normally don't consume this package directly — pick a binding:

- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react)
- [`@triggery/solid`](https://www.npmjs.com/package/@triggery/solid)
- [`@triggery/vue`](https://www.npmjs.com/package/@triggery/vue)

## Why "framework-agnostic"

The runtime is a plain object with a `Map`-based registry. It does not import React. It does not import a vDOM. It can be embedded in:

- a worker / service worker
- a Node.js process (CLI, server, edge)
- React Native (it just works — no DOM adapters needed for the runtime itself)
- a vanilla JS page

The same `createTrigger({...})` declaration runs unchanged across all of those. Bindings only wire `useEvent` / `useCondition` / `useAction` to the host framework's lifecycle.

## License

MIT &copy; Aleksey Skhomenko
