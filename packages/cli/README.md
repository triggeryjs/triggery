# @triggery/cli

Command-line companion for Triggery. Scaffolds projects, generates trigger files, prints the trigger graph, and runs ESLint with `@triggery/eslint-plugin` baked in.

```bash
pnpm add -D @triggery/cli
# or one-shot:
npx @triggery/cli <command>
```

## Commands

### `triggery create <directory> [--template vite-react|next-app|react-native]`

Downloads the corresponding starter template from `templates/<name>` in this repo (via [giget](https://github.com/unjs/giget)) and writes it to `<directory>`. Defaults to `vite-react`.

```bash
triggery create my-chat --template vite-react
cd my-chat
pnpm install
pnpm dev
```

### `triggery scaffold trigger <name>`

Generates `src/triggers/<name>.trigger.ts` with a minimal `createTrigger` stub. Use `--out-dir <path>` to point at a different directory.

### `triggery graph [directory]`

Statically walks `<directory>` for `*.trigger.ts` files, extracts each `createTrigger({ id, events, required })` call, and prints a graph. Format selection:

```bash
triggery graph . --format md > docs/triggers.md
triggery graph . --format dot --out triggery.dot && dot -Tsvg triggery.dot -o triggery.svg
triggery graph . --format json
```

### `triggery lint [...paths]`

Thin wrapper around the local `eslint` binary. Install `eslint` and `@triggery/eslint-plugin` alongside, set up the flat config (see `@triggery/eslint-plugin` README), then `triggery lint src`. Adds `--fix` for auto-fixable suggestions.

## Programmatic API

```ts
import { buildTriggerGraph, renderGraph, scaffoldTrigger, createProject } from '@triggery/cli';

const nodes = buildTriggerGraph({ cwd: process.cwd() });
console.log(renderGraph(nodes, 'md'));
```

## Related packages

- [`@triggery/eslint-plugin`](https://www.npmjs.com/package/@triggery/eslint-plugin) — Lint rules invoked by `triggery lint`.
- [`@triggery/codemod`](https://www.npmjs.com/package/@triggery/codemod) — Migration codemods invoked by the CLI.
- [`@triggery/vite`](https://www.npmjs.com/package/@triggery/vite) — Vite plugin for auto-discovery.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
