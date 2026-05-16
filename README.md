<p align="center">
  <img src="./.github/assets/banner.webp" alt="Triggery — write business logic, not boilerplate" width="100%" />
</p>

# Triggery

> **Write business logic, not boilerplate.**

[![CI](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml/badge.svg)](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/triggeryjs/triggery?utm_source=badge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

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

## Packages

| Package | Description |
|---|---|
| [`@triggery/core`](./packages/core) | Runtime: `createTrigger`, `createRuntime`, indexed dispatch, inspector, middleware, `graph()` |
| [`@triggery/react`](./packages/react) | React bindings: `useEvent`, `useCondition`, `useAction`, `useInlineTrigger`, `useInspectHistory`, `createNamedHooks`, `<TriggerRuntimeProvider>`, `<TriggerScope>` |
| [`@triggery/testing`](./packages/testing) | `createTestRuntime`, `mockCondition`, `mockAction`, `flushMicrotasks` |
| [`@triggery/vite`](./packages/vite) | Vite plugin: auto-imports every `*.trigger.ts` via a virtual module + HMR |
| [`@triggery/devtools-redux`](./packages/devtools-redux) | Middleware that streams runtime events into the Redux DevTools browser extension |
| [`@triggery/devtools-panel`](./packages/devtools-panel) | Drop-in React components for in-app inspection — `<InspectorView>`, `<TriggerSnapshotView>` |
| [`@triggery/devtools-bridge`](./packages/devtools-bridge) | `installDevtoolsBridge(runtime)` — page-side bridge for external inspectors (Chrome ext, standalone panel) |

DevTools extensions:

| Extension | Description |
|---|---|
| [`extensions/chrome-devtools`](./extensions/chrome-devtools) | Chrome DevTools panel — live inspector over `@triggery/devtools-bridge`. Load unpacked, see runs in a dedicated panel. |

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

Ten scenarios bench-ed against six neighbour libraries. Headline numbers (local M1 Pro, ops/sec; **bold = winner per row**). `Triggery (prod)` is `createRuntime({ inspector: false })` — the auto default in production builds.

| Scenario | Triggery | T (prod) | effector | rxjs | saga | xstate | reatom | mobx |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Plain dispatch | 620k | 606k | 370k | **16.8M** | 428k | 675k | 3.78M | 3.02M |
| Conditional (50% pass) | 566k | 649k | 566k | **14.5M** | 484k | 1.29M | 4.45M | 3.24M |
| Cascade A → B | 207k | 335k | 356k | **9.91M** | 202k | 429k | 5.10M | 1.60M |
| Take-latest cancellation | 280k | 301k | 226k | **4.16M** | 381k | 50k | 3.32M | 497k |
| Sparse bus (100 types, fire 1) | 611k | 690k | **5.05M** | 388k | 327k | 795k | **5.07M** | 2.94M |
| Lazy conditions (5 sources, read 1) | 589k | 659k | 212k | **2.45M** | 316k | 122k | 1.19M | 2.00M |
| Multi-event single trigger | 614k | 694k | 3.75M | **14.3M** | 410k | 636k | 3.09M | 2.48M |
| Toggle enable/disable + fire | 1.05M | 1.21M | 528k | **6.48M** | 302k | 474k | 2.81M | 2.35M |
| Realistic app bus (30 events × 30 triggers + condition + action) | 504k | 586k | 361k | 1.29M | 440k | 703k | **4.26M** | 3.00M |
| Lazy conditions at scale (10 sources, read 1 rotating) | 551k | 625k | 160k | **1.43M** | 310k | 72k | 634k | 1.63M |

#### How to read this table

**Triggery is not an event emitter or a state manager** — it's an orchestrator that sits on top of whichever store you already have. The five state/effect/atom libraries in the table all out-throughput Triggery on raw per-fire cost, which is exactly what you'd expect: a `Subject.next()` (rxjs), an `atom.set()` (Reatom) or a `box.set()` (MobX) are bare reactive primitives, while every Triggery fire also runs the inspector ring buffer, cascade context, required-gate, lazy condition proxy, abort controller bookkeeping and middleware chain. **That overhead is the product, not a bug.**

Where Triggery still pulls ahead despite the overhead: **scenario 5** (indexed dispatch beats rxjs and saga; ties Reatom for first), **scenarios 6 + 10** (pull-only conditions beat effector, saga, and xstate by 2-7×), **scenario 8** (first-class enable/disable beats effector, saga and xstate by 2-4×).

`inspector: false` saves the ring-buffer write, snapshot allocation and subscribe-listener fan-out per fire — consistent **+10-15% on dispatch-bound scenarios**. Devtools (`@triggery/devtools-redux`, `@triggery/devtools-bridge`, `useInspectHistory`) require the inspector to be on; production code that doesn't ship devtools gets the lean path for free.

Full breakdown + idiomatic implementations + per-scenario analysis in [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md).

## Status

Pre-MVP (Phase 1). Roadmap to 1.0 is tracked in the planning doc.

## License

MIT &copy; Aleksey Skhomenko
