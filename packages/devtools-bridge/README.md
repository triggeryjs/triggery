# @triggery/devtools-bridge

Page-side bridge that makes a Triggery runtime observable to external tools — the [Chrome extension](../../extensions/chrome-devtools), a future standalone web panel, custom inspectors, etc.

## Install

```bash
pnpm add @triggery/devtools-bridge
```

## Use

```ts
import { createRuntime } from '@triggery/core';
import { installDevtoolsBridge } from '@triggery/devtools-bridge';

const runtime = createRuntime();

if (import.meta.env.DEV) {
  installDevtoolsBridge(runtime);
}
```

That's it. The bridge:

1. Exposes a discovery handle on `window.__triggery_devtools__` so tools can detect the runtime.
2. Broadcasts a `triggery:hello` `postMessage` with the current `graph()` + inspector buffer.
3. Subscribes to the runtime and broadcasts a `triggery:snapshot` for every new run.
4. On `dispose()`, removes the discovery handle and broadcasts a `triggery:bye`.

In Node / SSR `installDevtoolsBridge` returns a no-op disposer.

## Wire format

```ts
{ source: 'triggery-devtools', type: 'triggery:hello',    runtimeId, graph, buffer, at }
{ source: 'triggery-devtools', type: 'triggery:snapshot', runtimeId, snapshot,     at }
{ source: 'triggery-devtools', type: 'triggery:bye',      runtimeId,               at }
```

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/devtools-panel`](https://www.npmjs.com/package/@triggery/devtools-panel) — In-app inspector React components.
- [`@triggery/devtools-redux`](https://www.npmjs.com/package/@triggery/devtools-redux) — Stream runtime events into the Redux DevTools extension.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
