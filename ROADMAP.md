# Roadmap

This roadmap reflects the current direction of Triggery. It is **not** a
schedule of promises — items can move based on feedback, contributions and
real-world usage data.

The canonical project tracker is the
[GitHub Project board](https://github.com/orgs/triggeryjs/projects). Items
below correspond to milestones on that board.

## Status: pre-1.0 (active development)

Pre-1.0 means the public API can still change between minor versions. We try
to ship codemods for any breaking change.

---

## Shipped

### Foundation
- pnpm monorepo, TypeScript strict, Biome, Vitest, tsup ESM-only build.
- GitHub Actions: CI (lint/typecheck/build/test), benchmarks (CodSpeed),
  release pipeline (changesets + Trusted Publishers / OIDC + `--provenance`).
- Dependabot grouped updates.

### Core runtime (`@triggery/core`)
- `createTrigger<Schema>` with inline-generic schema declaration.
- **Builder API (v0.10+)** — `createTrigger<S>().require(...).handle(...)`
  narrows required conditions to `NonNullable<...>` in the handler.
- **Inline `conditions:` config (v0.10+)** + typed
  `trigger.setCondition(name, value)` setter.
- **Action channels (v0.10+)** — `trigger.action(name).subscribe(cb)`
  multi-subscriber fan-out, additive with `runtime.registerAction`.
- **Inspector subpath (v0.10+)** — `@triggery/core/inspect` with
  `createInspectorFactory()` for bundle-friendly opt-in.
- Indexed dispatch (`Map<eventKey, Trigger[]>`), `required`-gate, lazy
  condition snapshots.
- Microtask scheduler (default), Sync scheduler.
- Middleware chain (`onFire` / `onBeforeMatch` / `onSkip` /
  `onActionStart` / `onActionEnd` / `onError` / `onCascade`).
- Cascade safety (depth limit, cycle detection).
- Inspector ring buffer + DEV/PROD auto-detection
  (`createRuntime({ inspector: false })`).
- `actions.debounce / throttle / defer / queue` chainable APIs.
- Async handlers with `AbortSignal` and `take-latest` /
  `take-every` / `take-first` / `queue` / `exhaust` / `sync` concurrency.
- `last-mount-wins` ownership with DEV warn-once.

### Framework bindings
- `@triggery/react` — `useEvent`, `useCondition`, `useAction`,
  `useInlineTrigger`, `useInspectHistory`, `createNamedHooks`,
  `<TriggerRuntimeProvider>`, `<TriggerScope>`.
- `@triggery/solid` — same API, native to signals + `onCleanup`.
- `@triggery/vue` — same API, `provide`/`inject` + `onScopeDispose`.

### Adapters
- State: `@triggery/zustand`, `@triggery/redux`, `@triggery/jotai`,
  `@triggery/mobx`, `@triggery/reatom`, `@triggery/signals`,
  `@triggery/query` (TanStack Query).
- Event sources: `@triggery/dom`, `@triggery/socket`.

### Tooling
- `@triggery/vite` — auto-discovery via virtual module + HMR.
- `@triggery/testing` — `createTestRuntime`, `mockCondition`,
  `mockAction`, `flushMicrotasks`.
- `@triggery/eslint-plugin` — 12 rules (`no-event-cascade`,
  `no-dynamic-id`, `hook-rules`, `exhaustive-conditions`,
  `exhaustive-required`, `max-handler-size`, `max-ports-per-trigger`,
  `prefer-named-hook`, **v0.10**: `no-non-null-assertion-in-handler`,
  `prefer-builder-trigger`, `prefer-trigger-conditions`,
  `prefer-action-channel`) plus `recommended` and `strict` flat-config presets.
- `@triggery/codemod` — `extract-trigger`,
  `migrate-from-listener-middleware`, **v0.10**: `migrate-to-v010` (inline
  conditions, drop non-null assertions, fan-out review markers) via
  ts-morph. CLI and programmatic API.
- `@triggery/cli` — `triggery create / scaffold trigger / graph / lint`.
  Pulls starters from `templates/*` via giget; prints the trigger
  graph as JSON / DOT / Markdown.
- Project starters in `templates/`: `vite-react`, `next-app`,
  `react-native` (Expo SDK 52).

### DevTools
- `@triggery/devtools-redux` — bridges runtime events into Redux DevTools.
- `@triggery/devtools-panel` — drop-in React components for in-app inspection.
- `@triggery/devtools-bridge` — page-side bridge for external inspectors.
- Chrome DevTools extension (load unpacked).

### Documentation
- [Docs site](https://triggeryjs.github.io) — Astro Starlight under
  `apps/docs/`, deployed on GitHub Pages via `.github/workflows/docs.yml`.
- Landing, Guide (30 pages: Essentials, Async, Architecture, Advanced,
  TypeScript, Testing, SSR), Recipes (8 React + Solid/Vue mirrors of the
  canonical scenarios), API reference (every public symbol across the 21
  `@triggery/*` packages), Packages catalogue, Migration cookbooks
  (`useEffect`, RTK listenerMiddleware, Redux Saga, redux-observable,
  mitt/nanoevents) plus comparisons vs XState / Effector / RxJS / MobX,
  Ecosystem index, Contributing handbook.
- Internationalisation scaffolding for 13 locales (en root, zh-CN, ja, uk,
  fr, ko, pt, bn, it, fa, ru, cs, zh-TW, pl) — translations will be filled
  in incrementally.

---

## In progress — towards 1.0

These are the gating items for cutting the 1.0 release.

- **REPL** at `play.triggery.dev` — paste a trigger, fire events, see
  inspector output. Shareable URL.
- **`migrate-from-saga` codemod** for `@triggery/codemod` — the
  `extract-trigger` and listener-middleware migrations shipped in 0.5;
  saga support is the remaining big migration path.
- **Webpack / Rspack** auto-discovery plugins (port of `@triggery/vite`).
- **TypeScript performance bench** — 100 triggers + 1000 hooks must
  compile in ≤ 20 s on M1.

## After 1.0

These items are scoped but not started.

- **`@triggery/devtools-replay`** — record + replay + time-travel.
- **Standalone web DevTools panel** (`@triggery/devtools-panel-app`) —
  WebSocket connection to any runtime, including remote browsers.
- **`@triggery/server`** — Node / Edge runtime + transport for server-side
  triggers (BFF / RSC).
- **`@triggery/otel`** — OpenTelemetry exporter (one span per run).
- **`@triggery/sentry`** — Sentry breadcrumbs adapter.
- **`@triggery/broadcast`** — multi-tab sync via BroadcastChannel.
- **Opt-in reactive conditions** (push) for high-frequency sources where
  pull would miss updates.
- **Static handler dependency capture** — first-run Proxy collects which
  conditions a handler actually reads; later runs only feed those.
- **VS Code extension** — code lens "used by N triggers", "Go to trigger",
  hover "which triggers listen to this event".

## Won't do (for now)

- **WebWorker offload** — interesting but not requested.
- **Visual rule editor** — XState already does this well; reuse via adapter.
- **Built-in state primitives** — Triggery is an orchestrator. State stays
  in your store of choice.
- **CLA bot** — MIT permissions are enough.

## Pre-1.0 milestones

| Milestone | Theme | Status |
|---|---|---|
| 0.1.0 | First public release with core + react + adapters | **Shipped** |
| 0.2.0 | Solid + Vue bindings | **Shipped** |
| 0.3.0 | Inspector opt-out + perf Tier 1 optimisations | **Shipped** |
| 0.4.0 | Docs site v1 | **Shipped** |
| 0.5.0 | `@triggery/eslint-plugin` + `@triggery/codemod` + `@triggery/cli` + starters | **Shipped** |
| 0.9.x | RC — feature freeze + community testing window | **Shipped** |
| 0.10.0 | Tier-2 ergonomics: inline conditions + setCondition, action channels, builder API with required-narrowing, inspector subpath, codemod + 4 new ESLint rules | **Shipped** |
| 0.9.x | REPL stub at `play.triggery.dev` | Planned |
| 1.0.0 | Stable | Planned |

## How to influence the roadmap

- Comment on items in the [GitHub Project board](https://github.com/orgs/triggeryjs/projects)
  with use cases.
- Open an [RFC issue](https://github.com/triggeryjs/triggery/issues/new?template=rfc.yml)
  for new directions.
- Adoption stories (link to your project / blog post) make it easier to
  prioritise the things people actually need.
