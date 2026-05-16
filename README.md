<p align="center">
  <img src="./.github/assets/banner.webp" alt="Triggery — write business logic, not boilerplate" width="100%" />
</p>

# Triggery

> **Write business logic, not boilerplate.**

[![CI](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml/badge.svg)](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/triggeryjs/triggery?utm_source=badge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A declarative, hook-first orchestration layer for React apps: **event → conditions → actions** in one file. Not a state manager, not an FRP framework — a thin coordinator that lifts business logic out of UI components.

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

Bench source: [`benchmarks/bench/dispatch.bench.ts`](./benchmarks/bench/dispatch.bench.ts). Live dashboard: [codspeed.io/triggeryjs/triggery](https://codspeed.io/triggeryjs/triggery).

### vs effector / rxjs / redux-saga / xstate

Four scenarios bench-ed against four neighbour libraries. Headline numbers (local M1 Pro, ops/sec):

| Scenario | Triggery | effector | rxjs | redux-saga | xstate |
|---|---:|---:|---:|---:|---:|
| Plain dispatch | 505k | 358k | 16.4M | 442k | 614k |
| Conditional (50% pass) | 516k | 565k | 14.3M | 456k | 999k |
| Cascade A → B | 249k | 343k | 9.5M | 206k | 423k |
| Take-latest | 307k | 228k | 4.0M | 383k | 50k |

rxjs wins raw throughput (thin `Subject` + operators, no graph/observability/cascade). Triggery is mid-pack on simple scenarios, beats effector + xstate on take-latest (we have built-in concurrency strategies), and trades modest dispatch overhead for built-in inspector + cascade tracking + scope gating.

Full methodology, idiomatic implementations of each library, and analysis: [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md).

## Status

Pre-MVP (Phase 1). Roadmap to 1.0 is tracked in the planning doc.

## License

MIT &copy; Aleksey Skhomenko
