# @triggery/devtools-redux

Middleware that streams [Triggery](https://github.com/triggeryjs/triggery) runtime events into the [Redux DevTools browser extension](https://github.com/reduxjs/redux-devtools/tree/main/extension) — no Redux required.

Every `fire`, `skip`, `action-start`, `action-end`, `error` and `cascade` event shows up as an action in the DevTools panel, with a growing history of recent runs as "state".

## Install

```bash
pnpm add -D @triggery/devtools-redux
```

## Use

```ts
import { createRuntime } from '@triggery/core';
import { reduxDevtoolsMiddleware } from '@triggery/devtools-redux';

const runtime = createRuntime({
  middleware: import.meta.env.DEV
    ? [reduxDevtoolsMiddleware({ name: 'My App', historyLimit: 200 })]
    : [],
});
```

If the Redux DevTools extension isn't installed (production builds, Node, browsers without the extension), the middleware degrades to a quiet no-op.

## License

MIT &copy; Aleksey Skhomenko
