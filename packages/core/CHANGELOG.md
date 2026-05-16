# @triggery/core

## 0.1.2

### Patch Changes

- f23e155: Filled out the quick-start sections in the npm package READMEs that adopters land on first.

  - `@triggery/core` README now contains a three-tab quick-start (React / Solid / Vue) with concrete `pnpm add` commands and runnable code, plus pointers to the per-binding README for the full walkthrough.
  - `@triggery/react` README — was a stub. Now has the full four-file scenario (trigger + provider + Chat + Toast) ready to copy-paste, exactly mirroring the Solid and Vue examples.

  Linked-bundle bump so the binding READMEs stay aligned with the core release; no code or API changes.

- 3385f5b: Every package README now ends with a tailored **Related packages** section and a consistent `## License` footer.

  - Adapter packages (`zustand`, `redux`, `jotai`, `mobx`, `reatom`, `signals`, `query`) link to `core` + `react` (required peers) plus 2-3 alternative adapters so adopters can swap them out without re-reading the whole repo.
  - Event-source packages (`dom`, `socket`) cross-link.
  - DevTools packages (`devtools-redux`, `devtools-panel`, `devtools-bridge`) cross-link.
  - Tooling packages (`eslint-plugin`, `codemod`, `cli`) cross-link.
  - Bindings (`react`, `solid`, `vue`) link to each other so users mid-migration know there's a sibling with the same hook API.
  - `@triggery/core/src/index.ts` JSDoc header had stale wording ("orchestration runtime for React business logic") — replaced with framework-agnostic phrasing matching the README.

  No code or API changes. Drop-in patch.

## 0.1.1

### Patch Changes

- 35936d1: Polished package metadata for framework-agnostic positioning.

  - `@triggery/core` description corrected: it is **framework-agnostic** (React, Solid, Vue, or any binding you write), not React-only. Keywords now include `solid`, `vue`, `framework-agnostic`, `zero-dependencies`. README expanded to spell out what runs where.
  - `@triggery/testing` README + description now mention **zero runtime dependencies** and that the kit works under Vitest, Jest, and `node:test` alike (no `vi.useFakeTimers` coupling).
  - `@triggery/devtools-bridge`, `@triggery/devtools-redux`, `@triggery/vite` descriptions clarified as framework-agnostic / runtime-pure.
  - `@triggery/react / solid / vue` descriptions now explicitly say **zero runtime dependencies** — the binding is a thin lifecycle adapter, nothing else.

  No API or behaviour changes.

## 0.1.0

First public preview release.

Declarative business-logic orchestration for React — core runtime

See the [repository-level CHANGELOG](../../CHANGELOG.md#010--2026-05-16) for the full set of packages and the umbrella feature list. Future entries on this file are appended automatically by changesets.
