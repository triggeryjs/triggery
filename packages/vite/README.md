# @triggery/vite

[Vite](https://vitejs.dev) plugin for [Triggery](https://github.com/triggeryjs/triggery) — auto-import every `*.trigger.ts` file via a virtual module.

## Install

```bash
pnpm add -D @triggery/vite
```

## Use

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import triggery from '@triggery/vite';

export default defineConfig({
  plugins: [triggery({ glob: 'src/**/*.trigger.ts' })],
});
```

Then once at the entry point of your app:

```ts
// src/main.tsx
import 'virtual:triggery-registry';
```

That's it — every file matching the glob is auto-imported, so its top-level `createTrigger(...)` call registers with the default runtime.

## Options

| Option | Default | Description |
|---|---|---|
| `glob` | `'src/**/*.trigger.{ts,tsx,js,jsx}'` | One pattern or an array. Anything `tinyglobby` accepts. |

## HMR

* Editing an existing trigger file just re-runs its `createTrigger(...)` — the runtime's last-mount-wins replaces the old registration. No special handling needed.
* Adding / removing / renaming a trigger file invalidates the virtual module so its import list is rebuilt on the next request.

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/vite/](https://triggeryjs.github.io/packages/vite/).

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer — runtime where discovered triggers register.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Most common combination with this plugin.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
