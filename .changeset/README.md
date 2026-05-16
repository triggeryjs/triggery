# Changesets

Every meaningful change in `packages/*` is accompanied by a changeset file — a record of which packages are affected, the bump type (major/minor/patch), and the changelog entry.

## Workflow

```bash
pnpm changeset              # describe the change — creates a .md file in this folder
git add .changeset
git commit -m "feat(core): add condition snapshot"
git push
```

When you merge into `main`, the `release.yml` workflow groups all accumulated changesets into a single "Version Packages" PR. Merging that PR publishes the affected packages to npm automatically.

Docs: https://github.com/changesets/changesets
