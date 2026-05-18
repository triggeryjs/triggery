# @triggery/react

## 1.0.0

### Minor Changes

- d920da6: ### `@triggery/core`

  - Inline conditions on `createTrigger({ conditions: { ... } })` plus a typed `trigger.setCondition(name, value)` setter (B1).
  - `trigger.action(name).subscribe(cb)` action channels — typed multi-subscriber fan-out that coexists with `runtime.registerAction` (B2).
  - New `Runtime.subscribeAction(triggerId, name, cb, options?)` — the additive, non-last-mount-wins subscription path used by the channel API.
  - Builder API: `createTrigger<S>()` (no args) returns a `TriggerBuilder<S>` with `.id`, `.events`, `.require`, `.conditions`, `.schedule`, `.concurrency`, `.scope`, `.handle`. `.require(...)` narrows handler `conditions` to `NonNullable<...>` — no more `!` or `if (!conditions.x) return;` (B3).
  - New subpath `@triggery/core/inspect` exports `createInspector`, `createNoopInspector`, `createInspectorFactory`. Pass `inspector: createInspectorFactory()` to `createRuntime` for the bundle-friendly opt-in pattern (A1).
  - New public types: `ActionChannel<P>`, `TriggerBuilder<S, R>`, `InspectorFactory`.

  ### `@triggery/react`, `@triggery/solid`, `@triggery/vue`

  - `useAction` now uses the additive `subscribeAction` path — multiple components mounting the same `useAction(trigger, name, ...)` all run on every emit (instead of the v0.9 last-mount-wins behaviour). Switch to `runtime.registerAction(trigger.id, name, fn)` if you relied on the old semantics.
  - React adds `useSetCondition(trigger, name, value)` — a thin wrapper over `useEffect(() => trigger.setCondition(...), [value])`.

  ### `@triggery/eslint-plugin`

  - 4 new rules:
    - `no-non-null-assertion-in-handler` (autofix) — flags `conditions.X!` inside a `createTrigger` handler.
    - `prefer-builder-trigger` — suggests the v0.10 builder form when `required: [...]` is used.
    - `prefer-trigger-conditions` — suggests inline `conditions:` config when a `registerCondition` getter reads a local `let`.
    - `prefer-action-channel` — flags hand-rolled `Set + for-of` fan-out and suggests `t.action(name).subscribe(cb)`.
  - `no-non-null-assertion-in-handler` is `warn` in `recommended`; the three `prefer-*` rules are `warn` in `strict`.

  ### `@triggery/codemod`

  - New codemod `migrate-to-v010` — ts-morph based. Folds `let + registerCondition` pairs into the `conditions:` config, removes `conditions.X!` assertions inside handlers, leaves review markers for fan-out patterns. CLI: `npx @triggery/codemod migrate-to-v010 'src/**/*.ts'`.

  ### Bundle (A1 + A2 + A3)

  - **DEV warnings tree-shake-able** — every console.warn / warnedCollisions cache lives under `if (process.env.NODE_ENV !== 'production')` so the bundler's production build drops them entirely. Helper functions live in their own `dev-warn.ts` module that gets eliminated cross-module.
  - **Production-only bundle** — `dist/index.prod.js` and `dist/inspect.prod.js` ship with DEV blocks stripped at our build time; picked automatically through the `"production"` export condition by Webpack / Vite / esbuild prod modes.
  - **Timer + dispatch helpers extracted** — `timers.ts` (debounce/throttle/defer) and `dispatch-helpers.ts` (genRunId, invokeAction) live in their own modules.
  - **Last-write-wins** for `runtime.registerCondition` / `runtime.registerAction` — the previous stack-based fallback was removed, simplifying the hot path. StrictMode safety preserved because the mount→unmount→mount cycle clears the unmount token before the second mount runs.
  - **Builder API moved to a subpath** — chainable `createTrigger<S>()` (no args) now lives in `@triggery/core/builder`; the imperative `createTrigger({ id, events, handler })` form stays in `@triggery/core`.
  - **Result**: `@triggery/core` main entry shrinks from **~5.2 KB gz to ~4.2 KB gz** when bundled by a production-configured downstream (—19%). Combined with `@triggery/core/builder` deduped via the bundler the total is **~3.8 KB gz** — below the 4 KB target.

  ### Backwards compatibility

  All v0.9 APIs continue to work. The legacy paths (`runtime.registerCondition`, `runtime.registerAction`, `createTrigger({ required: [...], handler })`, `createRuntime({ inspector: true })`) will gain `@deprecated` JSDoc in v0.11 and be removed in v1.0.

  See the [Upgrading from v0.9 guide](https://triggeryjs.github.io/migration/from-v0.9/).

### Patch Changes

- Updated dependencies [d920da6]
  - @triggery/core@1.0.0

## 0.1.2

### Patch Changes

- f23e155: Filled out the quick-start sections in the npm package READMEs that adopters land on first.

  - `@triggery/core` README now contains a three-tab quick-start (React / Solid / Vue) with concrete `pnpm add` commands and runnable code, plus pointers to the per-binding README for the full walkthrough.
  - `@triggery/react` README — was a stub. Now has the full four-file scenario (trigger + provider + Chat + Toast) ready to copy-paste, exactly mirroring the Solid and Vue examples.

  Linked-bundle bump so the binding READMEs stay aligned with the core release; no code or API changes.

- 3385f5b: Every package README now ends with a tailored **Related packages** section and a consistent `## License` footer.

  - Adapter packages (`zustand`, `redux`, `jotai`, `mobx`, `reatom`, `signals`, `query`) link to `core` + `react` (required peers) plus 2-3 alternative adapters so adopters can swap them out without re-reading the whole repo.
  - Event-source packages (`dom`, `socket`) cross-link.
  - DevTools packages (`devtools-redux`, `devtools-panel`, `devtools-bridge`) cross-link.
  - Tooling packages (`eslint-plugin`, `codemod`, `cli`) cross-link.
  - Bindings (`react`, `solid`, `vue`) link to each other so users mid-migration know there's a sibling with the same hook API.
  - `@triggery/core/src/index.ts` JSDoc header had stale wording ("orchestration runtime for React business logic") — replaced with framework-agnostic phrasing matching the README.

  No code or API changes. Drop-in patch.

- Updated dependencies [f23e155]
- Updated dependencies [3385f5b]
  - @triggery/core@0.1.2

## 0.1.1

### Patch Changes

- 35936d1: Polished package metadata for framework-agnostic positioning.

  - `@triggery/core` description corrected: it is **framework-agnostic** (React, Solid, Vue, or any binding you write), not React-only. Keywords now include `solid`, `vue`, `framework-agnostic`, `zero-dependencies`. README expanded to spell out what runs where.
  - `@triggery/testing` README + description now mention **zero runtime dependencies** and that the kit works under Vitest, Jest, and `node:test` alike (no `vi.useFakeTimers` coupling).
  - `@triggery/devtools-bridge`, `@triggery/devtools-redux`, `@triggery/vite` descriptions clarified as framework-agnostic / runtime-pure.
  - `@triggery/react / solid / vue` descriptions now explicitly say **zero runtime dependencies** — the binding is a thin lifecycle adapter, nothing else.

  No API or behaviour changes.

- Updated dependencies [35936d1]
  - @triggery/core@0.1.1

## 0.1.0

First public preview release.

React bindings for Triggery — hook-first orchestration layer

See the [repository-level CHANGELOG](../../CHANGELOG.md#010--2026-05-16) for the full set of packages and the umbrella feature list. Future entries on this file are appended automatically by changesets.
