# Triggery starter — Vite + React 19

A minimal React app wired up with `@triggery/core` and `@triggery/react`. The whole "Greet" scenario lives in [`src/triggers/welcome.trigger.ts`](./src/triggers/welcome.trigger.ts) — three independent components plug into the named ports.

## Get started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>.

## What's inside

- `src/triggers/welcome.trigger.ts` — the scenario as a `createTrigger` declaration.
- `src/App.tsx` — three components (`FriendlinessToggle`, `GreetButton`, `GreetingDisplay`) plug into the same trigger via `useCondition`, `useEvent`, `useAction`.
- `src/main.tsx` — wires up `<TriggerRuntimeProvider>` and registers the trigger module.
- `eslint.config.js` — drops in `@triggery/eslint-plugin` recommended preset.

## Useful scripts

- `pnpm dev` — Vite dev server.
- `pnpm build` — typecheck + production build.
- `pnpm lint` — ESLint with the Triggery preset.
- `pnpm graph` — `triggery graph` over your `src/triggers/**`.

## Next steps

- Read the [main README](https://github.com/triggeryjs/triggery#readme).
- Add a new scenario: `pnpm dlx @triggery/cli scaffold trigger <event-name>`.
- Visualise: `pnpm graph` (Markdown table) or `triggery graph . --format dot --out triggery.dot && dot -Tsvg triggery.dot -o triggery.svg`.
