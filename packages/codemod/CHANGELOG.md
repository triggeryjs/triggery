# @triggery/codemod

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

Codemods for migrating React/Redux side-effect code to Triggery — ts-morph powered.

See the [repository-level CHANGELOG](../../CHANGELOG.md#010--2026-05-16) for the full set of packages and the umbrella feature list. Future entries on this file are appended automatically by changesets.
