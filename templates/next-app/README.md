# Triggery starter — Next.js 15 (App Router)

Next.js App Router with `@triggery/core` and `@triggery/react` wired in via a client-component `<TriggeryProviders>` boundary. The whole "Greet" scenario lives in [`app/triggers/welcome.trigger.ts`](./app/triggers/welcome.trigger.ts).

## Get started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## What's inside

- `app/layout.tsx` — root layout, wraps the tree in `<TriggeryProviders>`.
- `app/providers.tsx` — `'use client'` boundary that owns the `createRuntime()` instance.
- `app/page.tsx` — the demo page. All hooks must live in client components.
- `app/triggers/welcome.trigger.ts` — the scenario as a `createTrigger` declaration.
- `eslint.config.js` — `@triggery/eslint-plugin` recommended preset.

## A note on Server Components

Triggery's runtime lives in the browser in this template; Server Components and Server Actions stay no-op for triggers. A first-class server runtime (`@triggery/server`) lands in V2 — see the [roadmap](https://github.com/triggeryjs/triggery/blob/main/ROADMAP.md).

## Useful scripts

- `pnpm dev` — Next dev server.
- `pnpm build` — production build.
- `pnpm lint` — ESLint with the Triggery preset.
- `pnpm graph` — `triggery graph` over your trigger files.
