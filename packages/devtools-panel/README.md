# @triggery/devtools-panel

React components for inspecting a [Triggery](https://github.com/triggeryjs/triggery) runtime in-app. Zero CSS pipeline — components use inline styles so they drop into any host.

## Install

```bash
pnpm add -D @triggery/devtools-panel
```

## Use

```tsx
import { InspectorView } from '@triggery/devtools-panel';

function DebugDrawer() {
  return import.meta.env.DEV ? <InspectorView limit={50} /> : null;
}
```

That's the full integration. The component subscribes to the active runtime (via `<TriggerRuntimeProvider>` context, or the global default) and shows a live list of recent runs. Clicking a row expands the full JSON snapshot.

## Components

| Component | Props | Use |
|---|---|---|
| `<InspectorView limit?={20} title?={'Triggery Inspector'} />` | `limit` — how many runs to show; `title` — header text or `null` to hide | Live, subscribed panel |
| `<TriggerSnapshotView snapshot variant?='compact'\|'full' />` | one snapshot from the inspector buffer | Render a single run row (`compact`) or expanded JSON (`full`) |

## Roadmap

The standalone (in-browser, postMessage-driven) panel and the Chrome DevTools wrapper land in V1.1 — see [`extensions/chrome-devtools`](../../extensions/chrome-devtools) for the manifest stub.

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer — these are React components.
- [`@triggery/devtools-redux`](https://www.npmjs.com/package/@triggery/devtools-redux) — Stream runtime events into the Redux DevTools extension.
- [`@triggery/devtools-bridge`](https://www.npmjs.com/package/@triggery/devtools-bridge) — Page-side bridge for external inspectors.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
