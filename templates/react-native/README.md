# Triggery starter — React Native (Expo)

A bare-bones Expo SDK 52 app showing how Triggery integrates with React Native. The same hook-API as web — `useEvent`, `useCondition`, `useAction` — works without any DOM-specific bindings.

## Get started

```bash
pnpm install
pnpm start
```

Then press `i` for iOS Simulator, `a` for Android Emulator, or `w` for web.

## What's inside

- `App.tsx` — root component, wraps the tree in `<TriggerRuntimeProvider>`. Three sub-components plug into the same trigger.
- `triggers/welcome.trigger.ts` — the scenario as a `createTrigger` declaration.
- `eslint.config.js` — `@triggery/eslint-plugin` recommended preset.

## React Native specifics

- No DOM, no `IntersectionObserver`, no `ResizeObserver` — the `@triggery/dom` adapter is out of scope here. Use platform-native event sources directly (`Animated`, gesture handlers, navigation events) and pipe them into `useEvent`.
- The runtime itself has zero RN-specific dependencies; the binding is just `@triggery/react`.

## Useful scripts

- `pnpm start` — Expo CLI dev server.
- `pnpm android` / `pnpm ios` / `pnpm web` — start in a specific target.
- `pnpm lint` — ESLint with the Triggery preset.
- `pnpm graph` — `triggery graph` over your trigger files.
