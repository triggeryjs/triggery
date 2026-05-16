# Contributing to Triggery

Thanks for taking the time to contribute. This document is meant to be short and
practical: read it once, then come back when you need a specific section.

## Table of contents

1. [Code of conduct](#code-of-conduct)
2. [Ways to contribute](#ways-to-contribute)
3. [Development setup](#development-setup)
4. [Repository layout](#repository-layout)
5. [Workflow](#workflow)
6. [Coding standards](#coding-standards)
7. [Tests](#tests)
8. [Benchmarks](#benchmarks)
9. [Changesets and releases](#changesets-and-releases)
10. [Commit messages](#commit-messages)
11. [Pull requests](#pull-requests)
12. [RFCs and large proposals](#rfcs-and-large-proposals)
13. [Reviewing a PR](#reviewing-a-pr)
14. [Releasing (maintainers only)](#releasing-maintainers-only)
15. [Getting your work merged](#getting-your-work-merged)

## Code of conduct

This project adheres to the [Contributor Covenant](./CODE_OF_CONDUCT.md).
By participating you are expected to uphold it. Report unacceptable behaviour
to `a@skhom.ru`.

## Ways to contribute

- **Triage issues** — reproduce reported bugs, add minimal repros, mark
  duplicates. Often the most valuable contribution.
- **Improve documentation** — fix typos, clarify wording, add diagrams,
  translate examples. Docs PRs are reviewed quickly.
- **Add adapters** — new framework binding, new state-manager adapter, new
  event source. See existing `packages/zustand`, `packages/dom` etc. for the
  pattern.
- **Fix bugs** — pick an issue labelled `good first issue` or `help wanted`.
- **Write benchmarks** — new scenarios in `benchmarks/bench/core/` or
  `benchmarks/bench/vs/`. Side-by-side comparisons against competing libraries
  are especially welcome (be fair to them — see the rules in
  [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md)).

## Development setup

Requirements:

- **Node.js** ≥ 20 (LTS recommended).
- **pnpm** ≥ 9 (enable via `corepack enable && corepack prepare pnpm@latest --activate`).
- **git** with a configured signing key (signed commits are not required but
  recommended).

```bash
git clone https://github.com/triggeryjs/triggery.git
cd triggery
pnpm install
pnpm build
pnpm test
```

If `pnpm test` is green you have a working environment.

The repository ships a `.devcontainer/` so you can also open it in
**GitHub Codespaces** or **VS Code Dev Containers** — no local setup needed.

## Repository layout

```
triggery/
├── packages/
│   ├── core/               # The runtime + createTrigger + middleware
│   ├── react/              # React hooks + providers
│   ├── solid/              # SolidJS bindings
│   ├── vue/                # Vue 3 bindings
│   ├── testing/            # createTestRuntime, mockCondition, mockAction
│   ├── vite/               # Vite plugin (auto-discovery + HMR)
│   ├── zustand/  redux/  jotai/  mobx/  reatom/  signals/  query/
│   ├── dom/    socket/
│   └── devtools-redux/  devtools-bridge/  devtools-panel/
├── extensions/
│   └── chrome-devtools/    # Chrome DevTools panel extension
├── benchmarks/
│   ├── bench/core/         # Triggery dispatch hot-path benches
│   └── bench/vs/           # Side-by-side comparisons
└── .changeset/             # Changeset files (one per merged feature/fix)
```

## Workflow

1. **Fork** the repository on GitHub.
2. **Create a branch** from `main`: `git checkout -b feat/short-description`.
3. **Make focused changes** — one logical change per PR. Big refactors
   alongside a bug fix make review hard.
4. **Add tests** for the change. Cover both the happy path and at least one
   edge case.
5. **Add a changeset** if the change touches anything in `packages/*`:
   `pnpm changeset` (see [Changesets and releases](#changesets-and-releases)).
6. **Run the local check suite** before pushing:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
7. **Push** and open a PR against `main`.

## Coding standards

- **TypeScript strict** is enabled across the monorepo. No `any`. Use
  `unknown` + narrowing when types are intentionally open.
- **Biome** handles formatting and lint — `pnpm format` (write) /
  `pnpm lint` (check). The CI enforces both.
- **No comments that restate the code**. Only comment the *why* when it is
  non-obvious — a hidden invariant, a deliberate trade-off, a known browser
  quirk. Match the surrounding style.
- **ESM only**, no CommonJS. `"type": "module"` everywhere.
- **No dependencies** in `@triggery/core`. Adapter packages take their
  target library as a `peerDependency`.
- **`exports` field** in `package.json` is the source of truth for entry
  points. Use it; do not rely on `main`/`module` heuristics.

## Tests

- All tests run under **Vitest** + **happy-dom**.
- Framework-specific tests live in each binding/adapter package:
  - `packages/react/__tests__/*.test.ts` (uses `@testing-library/react`).
  - `packages/solid/__tests__/*.test.tsx` (uses `@solidjs/testing-library`,
    requires `/** @jsxImportSource solid-js */` in `.tsx` test files because
    the root `tsconfig` defaults to React JSX).
  - `packages/vue/__tests__/*.test.ts` (uses `@vue/test-utils`).
- Core tests in `packages/core/__tests__/` should be DOM-free.
- Each new public API needs at least one test that exercises it end-to-end
  (event → condition gate → action).
- Aim for ≥ 95% line coverage in `@triggery/core` (`pnpm test:coverage`).

## Benchmarks

Benchmarks live in [`benchmarks/`](./benchmarks). They run under Vitest's
bench mode and are wired into CodSpeed in CI.

- Core dispatch hot-path: `benchmarks/bench/core/`.
- Side-by-side vs competing libraries: `benchmarks/bench/vs/`.

Run locally with `pnpm bench` (the side-by-side suites print ops/sec
deltas against effector / rxjs / saga / xstate / reatom / mobx).

When adding a "vs" scenario:

- Write the most idiomatic implementation of the scenario in each library you
  compare against — do not stack the deck.
- Reset / dispose state in `beforeEach` so the first run is not penalised.
- Document the scenario in
  [`benchmarks/COMPARISONS.md`](./benchmarks/COMPARISONS.md).

If a new benchmark shows Triggery losing badly, that is useful information.
**Land the benchmark anyway** — it gives us a target to optimise against.

## Changesets and releases

Triggery uses [changesets](https://github.com/changesets/changesets) for
versioning and publishing.

If your PR changes anything inside `packages/*`, add a changeset:

```bash
pnpm changeset
```

- Pick the packages affected.
- Pick the bump type (`patch` / `minor` / `major`).
- Write a one-line summary in the past tense — it becomes a CHANGELOG entry.

Infra-only PRs (CI config, docs, tests, repo hygiene) do **not** need a
changeset. The PR template has a checkbox to confirm.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:

```
<type>(<scope>): <subject>
```

- `type` — one of `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`,
  `build`, `ci`, `style`, `revert`.
- `scope` — package name without the `@triggery/` prefix (`core`, `react`,
  `vite`, `solid`, `vue`, `zustand`, …) or an area (`bench`, `docs`, `ci`).
- `subject` — imperative mood, lowercase, no trailing period, ≤ 72 chars.

Examples:

- `feat(core): add inspector opt-out via createRuntime({ inspector: false })`
- `fix(react): unregister condition on StrictMode double-mount`
- `bench(vs): add take-latest cancellation scenario`
- `docs(readme): collapse two Triggery columns into one`

Do **not** add AI-attribution trailers (`Co-Authored-By: Claude …` or
similar) to commits or PRs. Attribute work to humans.

## Pull requests

- One logical change per PR.
- Title in Conventional Commits format (the `semantic-pr` workflow enforces
  this).
- Fill in the PR template — particularly the checkboxes for `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` and the changeset.
- Link related issues with `Closes #123` so they auto-close on merge.
- Keep the diff focused. Unrelated cleanups in their own PR.

## RFCs and large proposals

For changes that affect public API surface, runtime semantics, or anything
described in the README or docs:

1. Open an [RFC issue](https://github.com/triggeryjs/triggery/issues/new?template=rfc.yml).
2. Get ≥ 1 maintainer approval on the design before writing code.

This avoids the "weeks of work, rejected at review" outcome that hurts
contributors and maintainers equally.

## Reviewing a PR

Reviewers — please be specific and kind. Concrete suggestions (with a code
block, a link to docs or a benchmark number) beat vague concerns.

Expected review SLA: maintainers respond within **5 business days**. Ping
the PR if there is no response after a week — life happens.

## Releasing (maintainers only)

1. The `release.yml` workflow opens a `chore: release packages` PR whenever
   unreleased changesets land on `main`.
2. Review the proposed version bumps and changelog entries.
3. Merge the release PR — changesets will publish to npm via
   [Trusted Publishers (OIDC)](https://docs.npmjs.com/trusted-publishers)
   with `--provenance`.
4. Verify the new versions on npm and announce via the channels described in
   [`MAINTAINERS.md`](./MAINTAINERS.md).

## Getting your work merged

PRs are merged when:

- CI is green (lint + typecheck + tests + build + benches).
- At least one maintainer has approved.
- Conflicts with `main` are resolved by rebase (not by merge commits).
- A changeset is present where required.

If you have not heard back in a week and the PR is small, comment on it. We
do not bite.

Thank you for contributing!
