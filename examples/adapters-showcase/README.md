# Triggery — adapters showcase

One Vite + React app demoing every Triggery adapter side by side. Each tab in the sidebar wires a different state library (or event source) into a tiny scenario — the only thing that changes between tabs is the adapter call.

## Try it

- <a href="https://triggeryjs.github.io/play/adapters-showcase/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/ecosystem/adapters/" target="_blank" rel="noopener noreferrer"><b>Read the adapters overview</b></a>

The StackBlitz link routes through a tiny launcher on the Triggery docs site
that uploads only this example's files to a fresh WebContainer — boots in
~2 s instead of the 30-60 s the legacy `stackblitz.com/github/…` URL spends
cloning the whole monorepo.

Or locally:

```bash
git clone https://github.com/triggeryjs/triggery
cd triggery
pnpm install
pnpm --filter triggery-example-adapters-showcase dev
```

Open <http://localhost:5174>.

## Tabs (one section per adapter)

| Tab | Adapter | What it shows |
|---|---|---|
| **Zustand** | `@triggery/zustand` | `useZustandCondition(trigger, name, store, selector)` reads the store snapshot at fire time. |
| **Redux** | `@triggery/redux` | `useReduxCondition(trigger, name, store, selector)` against an RTK store. |
| **Jotai** | `@triggery/jotai` | `useJotaiCondition(trigger, name, store, atom)`. |
| **MobX** | `@triggery/mobx` | `useMobxCondition(trigger, name, () => observable)` — no host tracking. |
| **Reatom** | `@triggery/reatom` | `useReatomCondition(trigger, name, atom, ctx)`. |
| **Signals** | `@triggery/signals` | `useSignalCondition(trigger, name, signal)` with `@preact/signals-core`. |
| **TanStack Query** | `@triggery/query` | `useQueryCondition` against the query cache. |
| **DOM events** | `@triggery/dom` | `useDomEvent` turns native `click` into a typed event. |
| **WebSocket** | `@triggery/socket` | `useWebSocketEvent` against a fake socket that ticks every 1.5s. |

## File map

- [`src/main.tsx`](./src/main.tsx) — runtime + provider wiring.
- [`src/App.tsx`](./src/App.tsx) — sidebar + tab switcher.
- [`src/sections/*.tsx`](./src/sections) — one section per adapter, each defines its own trigger and a tiny UI to exercise it.
