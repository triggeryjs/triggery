# @triggery/eslint-plugin

ESLint plugin for Triggery: catches mis-use of `createTrigger` and the hook-API, enforces conventions, and keeps trigger files readable as specs.

```bash
pnpm add -D @triggery/eslint-plugin
```

## Rules

| Rule                       | Recommended | Strict        | Auto-fix |
|---------------------------|:-----------:|:-------------:|:--------:|
| `no-dynamic-id`            | error       | error         | —        |
| `no-event-cascade`         | error       | error         | —        |
| `hook-rules`               | error       | error         | —        |
| `exhaustive-conditions`    | warn        | error         | —        |
| `exhaustive-required`      | warn        | error         | —        |
| `max-handler-size`         | warn (≤50)  | error (≤30)   | —        |
| `max-ports-per-trigger`    | warn (≤12)  | error (≤8)    | —        |
| `prefer-named-hook`        | off         | warn (≥3)     | —        |

## Flat config (ESLint 9.x)

```js
// eslint.config.js
import triggery from '@triggery/eslint-plugin';

export default [
  triggery.configs.recommended,
  // Or, if you want everything dialled up:
  // triggery.configs.strict,
];
```

## Cherry-picking individual rules

```js
import triggery from '@triggery/eslint-plugin';

export default [
  {
    plugins: { '@triggery': triggery },
    rules: {
      '@triggery/no-dynamic-id': 'error',
      '@triggery/no-event-cascade': 'error',
      '@triggery/max-handler-size': ['warn', { max: 40 }],
    },
  },
];
```

## Per-rule

### `no-dynamic-id`

`createTrigger({ id })` must be a string literal. Trigger ids are runtime registry keys, devtools action labels and graph-output anchors — they must be deterministic.

### `no-event-cascade`

Disallows calling `useEvent(...)` inside a `useAction(...)` handler. Cascades are allowed at runtime (up to `maxCascadeDepth`), but writing them inline hides cross-trigger control flow.

### `hook-rules`

Framework-neutral rules-of-hooks: `useEvent` / `useCondition` / `useAction` / `useInlineTrigger` must be called from a component (function whose name starts with an uppercase letter) or a custom hook (function whose name starts with `use[A-Z]`).

### `exhaustive-conditions`

If a trigger declares `required: ['user','settings']`, the same file must contain at least one `useCondition(<trigger>, 'user', ...)` and one `useCondition(<trigger>, 'settings', ...)`. Cross-file checks are intentionally out of scope to keep the rule fast and predictable.

### `exhaustive-required`

Every `createTrigger({...})` call must include an explicit `required:` key (use `required: []` if no conditions are required). Catches the common mistake of "I forgot the gate, the handler will run on every fire even when the world isn't ready".

### `max-handler-size` (configurable, default 50)

```js
'@triggery/max-handler-size': ['warn', { max: 50 }]
```

Counts top-level statements in the handler body. If you hit the limit, consider the `extract-trigger` codemod from `@triggery/codemod`.

### `max-ports-per-trigger` (configurable)

```js
'@triggery/max-ports-per-trigger': ['warn', { maxEvents: 8, maxConditions: 8, maxTotal: 12 }]
```

Caps the per-trigger port count to keep scenarios spec-like.

### `prefer-named-hook` (configurable, off by default)

```js
'@triggery/prefer-named-hook': ['warn', { threshold: 4 }]
```

Once a file has `threshold` or more port calls, suggests switching from `useEvent(trigger, 'new-message')` to the named hook `useNewMessageEvent` (available via `trigger.namedHooks()`).

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/eslint-plugin/](https://triggeryjs.github.io/packages/eslint-plugin/).

## Related packages

- [`@triggery/codemod`](https://www.npmjs.com/package/@triggery/codemod) — Codemods that introduce trigger files this plugin then checks.
- [`@triggery/cli`](https://www.npmjs.com/package/@triggery/cli) — `triggery lint` ships this plugin's `recommended` preset by default.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
