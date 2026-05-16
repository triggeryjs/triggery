# @triggery/codemod

Codemods that mechanically migrate React/Redux side-effect code to Triggery's `event → conditions → actions` model. Powered by [ts-morph](https://ts-morph.com).

```bash
pnpm add -D @triggery/codemod
```

## CLI

```bash
# Pull a useEffect block out of a component into a *.trigger.ts file.
npx triggery-codemod extract-trigger --name new-message src/Chat.tsx

# Generate one trigger per RTK listenerMiddleware.startListening({ actionCreator, effect }).
npx triggery-codemod migrate-from-listener-middleware src/store/middleware.ts
```

Add `--dry-run` to preview without writing.

## Programmatic API

```ts
import { extractTrigger, migrateFromListenerMiddleware } from '@triggery/codemod';

extractTrigger({ file: 'src/Chat.tsx', name: 'new-message' });

migrateFromListenerMiddleware({ file: 'src/store/middleware.ts' });
```

## What each codemod does (and what it leaves to you)

### `extract-trigger`

Reads the first `useEffect(() => { … }, [])` in the file and writes a sibling `<name>.trigger.ts` containing a stub `createTrigger({…, handler() { /* original body */ } })`. The component is rewritten to call `useEvent(<name>Trigger, '<event-name>')` instead.

The codemod intentionally **does not**:

- Infer the `events` / `conditions` / `actions` schema generic — you write it.
- Move closure-captured state into typed conditions — refactor by hand.
- Touch cleanup functions or effects with conditional deps — handle manually.

### `migrate-from-listener-middleware`

For each `startListening({ actionCreator, effect })` call in the file, generates one `<event-name>.trigger.ts`. The `effect` body is dropped verbatim into the new trigger's handler with a `// TODO: refactor dispatch/getState into actions/conditions` marker.

Other listenerMiddleware shapes (`matcher`, `predicate`, `type`) are detected but skipped — they need human review.

## Why ts-morph (and not jscodeshift / babel)?

ts-morph is the TypeScript Compiler API with a nicer surface. It speaks JSX and the same type system the rest of Triggery is built on. The codemods produce TypeScript output, so type-aware AST work would be a regression with jscodeshift's recast-based round-trip.

## Related packages

- [`@triggery/eslint-plugin`](https://www.npmjs.com/package/@triggery/eslint-plugin) — Lint rules that catch issues this codemod can't repair.
- [`@triggery/cli`](https://www.npmjs.com/package/@triggery/cli) — `triggery scaffold trigger` for greenfield files.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
