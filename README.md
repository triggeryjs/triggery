<p align="center">
  <img src="./.github/assets/banner.webp" alt="Triggery — write business logic, not boilerplate" width="100%" />
</p>

# Triggery

> **Write business logic, not boilerplate.**

[![CI](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml/badge.svg)](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/triggeryjs/triggery?utm_source=badge)
[![Coverage ≥95%](https://img.shields.io/badge/coverage-%E2%89%A595%25-brightgreen)](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/triggeryjs/triggery)
[![npm version](https://img.shields.io/npm/v/@triggery/core?label=%40triggery%2Fcore)](https://www.npmjs.com/package/@triggery/core)
[![Bundle size](https://img.shields.io/bundlejs/size/@triggery/core?label=core%20gzip)](https://bundlejs.com/?q=%40triggery%2Fcore)
[![npm downloads](https://img.shields.io/npm/dm/@triggery/core?label=downloads)](https://www.npmjs.com/package/@triggery/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Sponsor on Patreon](https://img.shields.io/badge/sponsor-patreon-ff424d?logo=patreon&logoColor=white)](https://www.patreon.com/triggery)
[![Sponsor on Boosty](https://img.shields.io/badge/sponsor-boosty-f15f2c?logo=boosty&logoColor=white)](https://boosty.to/triggery)
[![Discussions](https://img.shields.io/github/discussions/triggeryjs/triggery)](https://github.com/triggeryjs/triggery/discussions)
[![Discord](https://img.shields.io/badge/chat-discord-5865f2?logo=discord&logoColor=white)](https://triggeryjs.github.io/discord/)
[![GitHub stars](https://img.shields.io/github/stars/triggeryjs/triggery?style=social)](https://github.com/triggeryjs/triggery/stargazers)

**Not an event emitter. Not a state manager. Triggery orchestrates business logic across your app.**

A declarative, hook-first coordination layer for React: **event → conditions → actions** in one file. State lives in your store of choice (Zustand, Redux, Jotai, MobX, signals — anything). Events come from anywhere (WebSockets, DOM, your UI). Triggery sits between them and decides *when* to do *what*, *if* the world is in the right shape.

## Example: "show a toast for incoming messages, with sound, unless I'm already on that channel"

### 1. The scenario lives in one file

```ts
// triggers/message.trigger.ts
import { createTrigger } from '@triggery/core';

export const messageTrigger = createTrigger<{
  events: {
    'new-message': { author: string; text: string; channelId: string };
  };
  conditions: {
    user: { id: string; name: string };
    settings: { sound: boolean; notifications: boolean };
    activeChannelId: string | null;
  };
  actions: {
    showToast: { title: string; body: string };
    playSound: 'beep' | 'mod-alert';
  };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['user', 'settings'],
  handler({ event, conditions, actions, check }) {
    if (!conditions.user || !conditions.settings) return;

    // Don't notify about the channel I'm currently looking at.
    if (conditions.activeChannelId === event.payload.channelId) return;

    // Don't notify for my own messages.
    if (event.payload.author === conditions.user.name) return;

    if (!check.is('settings', (s) => s.notifications)) return;

    actions.showToast?.({
      title: event.payload.author,
      body: event.payload.text,
    });

    if (check.is('settings', (s) => s.sound)) {
      actions.playSound?.('beep');
    }
  },
});
```

### 2. UI components only provide ports — they know nothing about each other

```tsx
// auth/UserProvider.tsx — supplies "who I am"
useCondition(messageTrigger, 'user', () => currentUser, [currentUser]);

// settings/SettingsProvider.tsx — supplies notification preferences
useCondition(
  messageTrigger,
  'settings',
  () => ({ sound: prefs.sound, notifications: prefs.notifications }),
  [prefs.sound, prefs.notifications],
);

// chat/ActiveChannelTracker.tsx — supplies which channel is in focus
useCondition(messageTrigger, 'activeChannelId', () => currentChannelId, [currentChannelId]);

// chat/Chat.tsx — emits the event when a WS message arrives
const fire = useEvent(messageTrigger, 'new-message');
useEffect(() => socket.on('msg', fire), [fire]);

// notifications/Toast.tsx — knows how to render a toast
useAction(messageTrigger, 'showToast', ({ title, body }) =>
  toast.success(title, { description: body }),
);

// notifications/SoundPlayer.tsx — knows how to play a sound
useAction(messageTrigger, 'playSound', (kind) => audioBus.play(kind));
```

Six files, one scenario, no prop drilling, no `useEffect` chains, no central thunk/saga. The trigger reads like a spec.

## Install

> Pre-1.0: the API is unstable; minor versions may introduce breaking changes.

```bash
pnpm add @triggery/core @triggery/react
```

## Documentation

The full documentation site is at **<https://triggeryjs.github.io>** — Guide, Recipes (React / Solid / Vue), API reference for every public symbol, Packages catalogue, Migration cookbooks (from `useEffect`, RTK listenerMiddleware, Redux Saga, redux-observable), and the Contributing handbook.

The site is built with Astro Starlight under [`apps/docs/`](./apps/docs) and deployed by GitHub Pages on every push to `main`.

## Try it in 5 seconds

A runnable Vite + React example lives in [`examples/vite-react-counter`](./examples/vite-react-counter). Open it without cloning — these links boot a fresh StackBlitz WebContainer with the example's files inlined (no monorepo clone, ~2 s cold start):

[![Open the counter in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://triggeryjs.github.io/play/vite-react-counter/)
[![Open the notifications pipeline in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://triggeryjs.github.io/play/vite-react-notifications/)

Other ready-to-play scenarios (each opens straight in StackBlitz with no waiting):

- [`vite-react-debounced-search`](https://triggeryjs.github.io/play/vite-react-debounced-search/) — `take-latest` + 300 ms debounce + AbortSignal
- [`vite-react-modal-stack`](https://triggeryjs.github.io/play/vite-react-modal-stack/) — modal coordinator with focus restore + scroll-lock
- [`vite-react-diagram-table-sync`](https://triggeryjs.github.io/play/vite-react-diagram-table-sync/) — diagram ⇄ table bidirectional selection sync
- [`vite-solid-notifications`](https://triggeryjs.github.io/play/vite-solid-notifications/) and [`vite-vue-notifications`](https://triggeryjs.github.io/play/vite-vue-notifications/) — same trigger, other bindings

Or open the full repo in Codespaces if you want to poke at multiple packages at once:

[![Open in Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/triggeryjs/triggery)

> Each `play/…` link goes through a tiny launcher page on the docs site that uploads the example's source straight to a StackBlitz WebContainer via their inline-files API. Way faster than the legacy `stackblitz.com/github/…` URL which clones the whole 47 MB monorepo before mounting the subdir.

## Packages

### Core

| Package | Description |
|---|---|
| [`@triggery/core`](./packages/core) | Runtime: `createTrigger`, `createRuntime`, indexed dispatch, inspector, middleware, `graph()` |
| [`@triggery/testing`](./packages/testing) | `createTestRuntime`, `mockCondition`, `mockAction`, `flushMicrotasks` |
| [`@triggery/vite`](./packages/vite) | Vite plugin: auto-imports every `*.trigger.ts` via a virtual module + HMR |

### Framework bindings

Same `useEvent` / `useCondition` / `useAction` API across all three. Pick the one for your framework — Triggery itself is framework-agnostic.

| Package | Description |
|---|---|
| [`@triggery/react`](./packages/react) | React bindings: `useEvent`, `useCondition`, `useAction`, `useInlineTrigger`, `useInspectHistory`, `createNamedHooks`, `<TriggerRuntimeProvider>`, `<TriggerScope>` |
| [`@triggery/solid`](./packages/solid) | SolidJS bindings — same API, native to signals + `onCleanup` |
| [`@triggery/vue`](./packages/vue) | Vue 3 bindings — same API, `provide`/`inject` + `onScopeDispose` |

### Adapters

Bridge any store / signal / atom into a Triggery condition without subscribing the host component to updates.

| Package | Description |
|---|---|
| [`@triggery/zustand`](./packages/zustand) | `useZustandCondition(trigger, name, store, selector)` |
| [`@triggery/redux`](./packages/redux) | `useReduxCondition(trigger, name, store, selector)` |
| [`@triggery/jotai`](./packages/jotai) | `useJotaiCondition(trigger, name, store, atom, selector?)` |
| [`@triggery/mobx`](./packages/mobx) | `useMobxCondition(trigger, name, () => observable)` — no dependency tracking on the host |
| [`@triggery/reatom`](./packages/reatom) | `useReatomCondition(trigger, name, atom, selector?)` (Reatom v1000+) |
| [`@triggery/signals`](./packages/signals) | `useSignalCondition(trigger, name, signal, selector?)` — `@preact/signals-core`, `alien-signals`, any `peek()` / `.value`-shaped signal |
| [`@triggery/query`](./packages/query) | `useQueryCondition(trigger, name, queryClient, queryKey, selector?)` — TanStack Query cache |

Pipe events from outside React into triggers:

| Package | Description |
|---|---|
| [`@triggery/dom`](./packages/dom) | `useDomEvent`, `useResizeObserver`, `useIntersectionObserver` |
| [`@triggery/socket`](./packages/socket) | `useSocketIoEvent` (socket.io-client), `useWebSocketEvent` (native WebSocket) |

### DevTools

| Package | Description |
|---|---|
| [`@triggery/devtools-redux`](./packages/devtools-redux) | Middleware that streams runtime events into the Redux DevTools browser extension |
| [`@triggery/devtools-panel`](./packages/devtools-panel) | Drop-in React components for in-app inspection — `<InspectorView>`, `<TriggerSnapshotView>` |
| [`@triggery/devtools-bridge`](./packages/devtools-bridge) | `installDevtoolsBridge(runtime)` — page-side bridge for external inspectors (Chrome ext, standalone panel) |

| Extension | Description |
|---|---|
| [`extensions/chrome-devtools`](./extensions/chrome-devtools) | Chrome DevTools panel — live inspector over `@triggery/devtools-bridge`. Load unpacked, see runs in a dedicated panel. |

### Tooling

| Package | Description |
|---|---|
| [`@triggery/eslint-plugin`](./packages/eslint-plugin) | ESLint 9 flat-config plugin. Eight rules covering `no-event-cascade`, `no-dynamic-id`, `hook-rules`, exhaustive-required/conditions, handler/port-count budgets, and named-hook suggestions. `recommended` and `strict` presets. |
| [`@triggery/codemod`](./packages/codemod) | ts-morph powered codemods: `extract-trigger` (pull a useEffect block into a `*.trigger.ts` file) and `migrate-from-listener-middleware` (one trigger per RTK `startListening` registration). CLI and programmatic API. |
| [`@triggery/cli`](./packages/cli) | `triggery create / scaffold / graph / lint`. Downloads starters from `templates/*` via giget, scaffolds new trigger files, prints the trigger graph as JSON / DOT / Markdown, and shims `eslint` with the recommended preset. |

### Project starters

```bash
pnpm dlx @triggery/cli create my-chat --template vite-react
pnpm dlx @triggery/cli create my-app --template next-app
pnpm dlx @triggery/cli create my-rn-app --template react-native
```

| Starter | Stack |
|---|---|
| [`templates/vite-react`](./templates/vite-react) | Vite 7 + React 19 + Triggery. Minimal "Greet" scenario across three components. |
| [`templates/next-app`](./templates/next-app) | Next.js 15 (App Router) + React 19 + Triggery, with a `'use client'` provider boundary. |
| [`templates/react-native`](./templates/react-native) | Expo SDK 52 + React Native 0.76 + Triggery. Same hook-API as web, no DOM. |

## Why

Business logic of the form _"when X happens, do Y if Z is true"_ is currently spread across `useEffect`, sagas, observable middleware, listener middleware and thunks. Symptoms:

* Prop-drilling of callbacks; ad-hoc contexts just to make one component call another.
* Side-effects glued to UI components.
* A single scenario ("message arrived → not the active channel → badge + sound + toast") scattered across three features.
* No way to see at a glance _what will happen when X occurs_.

Triggery's answer: **a scenario is one file**. The file reads like a spec.

## Performance

Measured on CodSpeed CPU-simulation runners (deterministic cycle counts, not wall-time). Reproducible via `pnpm bench`.

| Scenario | Throughput |
|---|---:|
| `fireEvent` with no registered triggers (baseline) | **27.6M ops/sec** |
| Single trigger, 0 conditions, 1 action | **634k ops/sec** |
| 10 triggers, each with 2 conditions and 1 action | **44k ops/sec** |

Bench source: [`benchmarks/bench/core/dispatch.bench.ts`](./benchmarks/bench/core/dispatch.bench.ts). Live dashboard: [codspeed.io/triggeryjs/triggery](https://codspeed.io/triggeryjs/triggery). Two suites are published: **`core`** (Triggery's own dispatch hot path) and **`vs`** (side-by-side with effector/rxjs/redux-saga/xstate).

### vs effector / rxjs / redux-saga / xstate / Reatom / MobX

Ten scenarios bench-ed against six neighbour libraries. Headline numbers (local M1 Pro, ops/sec; **bold = winner per row**). Triggery column shows the production default (`createRuntime({ inspector: false })`); the dev-default with the inspector on runs ~10-15% slower across most rows. Both modes appear side-by-side in [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md).

| Scenario | Triggery | effector | rxjs | saga | xstate | reatom | mobx |
|---|---:|---:|---:|---:|---:|---:|---:|
| Plain dispatch | 604k | 353k | **16.2M** | 399k | 674k | 3.59M | 3.09M |
| Conditional (50% pass) | 607k | 554k | **14.5M** | 459k | 1.00M | 2.93M | 3.02M |
| Cascade A → B | 317k | 359k | **9.72M** | 247k | 402k | 5.00M | 1.59M |
| Take-latest cancellation | 287k | 227k | **3.98M** | 329k | 51k | 3.52M | 528k |
| Sparse bus (100 types, fire 1) | 692k | 4.79M | 401k | 317k | 826k | **4.80M** | 3.09M |
| Lazy conditions (5 sources, read 1) | 650k | 219k | **2.48M** | 329k | 124k | 1.01M | 2.10M |
| Multi-event single trigger | 691k | 3.65M | **14.4M** | 545k | 792k | 4.04M | 2.89M |
| Toggle enable/disable + fire | 1.11M | 492k | **6.61M** | 246k | 468k | 2.81M | 2.46M |
| Realistic app bus (30 events × 30 triggers + condition + action) | 575k | 263k | 1.28M | 450k | 742k | **4.40M** | 2.95M |
| Lazy conditions at scale (10 sources, read 1 rotating) | 635k | 156k | 1.39M | 324k | 77k | 694k | **1.56M** |

#### How to read this table

**Triggery is not an event emitter or a state manager** — it's an orchestrator that sits on top of whichever store you already have. The five state/effect/atom libraries in the table all out-throughput Triggery on raw per-fire cost, which is exactly what you'd expect: a `Subject.next()` (rxjs), an `atom.set()` (Reatom) or a `box.set()` (MobX) are bare reactive primitives, while every Triggery fire also runs the inspector ring buffer, cascade context, required-gate, lazy condition proxy, abort controller bookkeeping and middleware chain. **That overhead is the product, not a bug.**

Where Triggery still pulls ahead despite the overhead: **scenario 5** (indexed dispatch beats rxjs by ~1.7× and saga by ~2.2× — though effector and Reatom hold the top of this one together at ~4.8M each), **scenarios 6 + 10** (pull-only conditions beat effector, saga, and xstate by 2-8×), **scenario 8** (first-class enable/disable beats effector, saga and xstate by 2.4-4.5×).

Full breakdown + idiomatic implementations + per-scenario analysis in [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md).

## Status

Pre-1.0 — public API can still change between minor versions. Roadmap to 1.0 lives in [`ROADMAP.md`](./ROADMAP.md). High-level milestones are tracked on the [GitHub Project board](https://github.com/orgs/triggeryjs/projects).

## Community

- [**Discord**](https://triggeryjs.github.io/discord/) — live chat, help with React/Solid/Vue + adapter packages, RFC discussions, devlog.
- [**GitHub Discussions**](https://github.com/triggeryjs/triggery/discussions) — long-form Q&A, searchable answers that survive past the chat scroll.
- **X / Twitter** — [`@triggeryjs`](https://x.com/triggeryjs).
- **Bluesky** — [`@triggeryjs.bsky.social`](https://bsky.app/profile/triggeryjs.bsky.social) (reserved).
- **Stack Overflow** — tag your question with [`triggery`](https://stackoverflow.com/questions/tagged/triggery).

See [`SUPPORT.md`](./SUPPORT.md) for the full "where do I ask X" guide.

## Contributing

PRs, RFCs, bug reports and documentation fixes are all welcome. Start here:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup, workflow, coding standards, changesets.
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — Contributor Covenant 2.1.
- [`GOVERNANCE.md`](./GOVERNANCE.md) — how decisions are made.
- [`SECURITY.md`](./SECURITY.md) — responsible disclosure for security issues.
- [Good first issues](https://github.com/triggeryjs/triggery/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — direct CTA if you want a small win.

Looking for something larger? Pick from [`ROADMAP.md`](./ROADMAP.md) or open an [RFC issue](https://github.com/triggeryjs/triggery/issues/new?template=rfc.yml).

## Sponsors

Triggery is built in the open and is free under the MIT licence. If your team relies on it, please consider sponsoring — it directly funds maintenance, docs, and the bug-bounty programme.

- **Patreon** (international) — <https://www.patreon.com/triggery>
- **Boosty** (RU/CIS-friendly) — <https://boosty.to/triggery>

> GitHub Sponsors is intentionally omitted — it is not available to the maintainer's region. Patreon is the international channel.

Corporate sponsors get a logo here once the programme launches. Reach out at `a@skhom.ru` with subject `[triggery sponsorship]`.

## Contributors

<a href="https://github.com/triggeryjs/triggery/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=triggeryjs/triggery" alt="Contributors graph" />
</a>

Pull requests, bug reports, and design feedback are all welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, workflow, and the RFC process for larger proposals. The contributor mosaic above is generated by [contrib.rocks](https://contrib.rocks) and auto-refreshes whenever the contributors list changes — no workflow, no PRs, just a CDN that follows the repo.

## License

MIT &copy; Aleksey Skhomenko — see [`LICENSE`](./LICENSE).
