# Governance

Triggery is currently a small project led by a single maintainer. This
document describes how decisions are made today and how that will evolve as
the project grows.

## Current status

- **Project lead**: Aleksey Skhomenko ([@triggeryjs](https://github.com/triggeryjs))
- **Maintainers**: see [`MAINTAINERS.md`](./MAINTAINERS.md)
- **License**: MIT (see [`LICENSE`](./LICENSE))

The project lead has final say on technical direction, releases, and conduct
enforcement until the maintainer team grows to at least three active members.

## Decision making

We use **lazy consensus**: any maintainer can propose a change as a PR or
RFC. After 72 hours with no objections from other maintainers, the change
is considered accepted. If objections are raised, discussion continues until
consensus is reached or the project lead breaks the tie.

For large changes (new public API, breaking change, security-sensitive
behaviour) we require:

1. An [RFC issue](https://github.com/triggeryjs/triggery/issues/new?template=rfc.yml)
   describing the problem, proposed solution, alternatives considered, and
   migration path.
2. At least one maintainer approval on the design.
3. A reasonable comment window (usually 7 days for non-urgent changes).

For routine work (bug fixes, doc updates, dependency bumps, new tests),
one maintainer approval on the PR is enough.

## Becoming a maintainer

We invite people to become maintainers when they have:

- Landed multiple non-trivial PRs over at least two release cycles.
- Demonstrated good judgement on review of others' PRs.
- Shown willingness to take on triage / release / governance work.

Nominations are proposed privately to the project lead, who then proposes
the nomination to existing maintainers. A single objection from another
maintainer blocks the nomination (which is then re-discussed).

Maintainers can step down at any time. After 6 months of no activity and
no response to a check-in email, a maintainer is moved to **emeritus**
status (still credited, no commit rights).

## Releases

- Versioning follows [Semantic Versioning](https://semver.org/).
- All releases go through [changesets](https://github.com/changesets/changesets).
- Pre-1.0: minor versions may include breaking changes. We aim to ship
  codemods for any non-trivial breaking change.
- Post-1.0: breaking changes only in major versions, with at least 30 days
  of pre-release window for community testing.

## Funding and resources

Donations via the channels listed in [`.github/FUNDING.yml`](./.github/FUNDING.yml)
go directly to the project lead and are used to cover:

- Domain names (`triggery.dev`, `triggeryjs.dev`).
- CI minutes beyond GitHub free tier.
- Bug bounty programme (when established).
- Stipends to active maintainers (when funding allows).

A public ledger will be published once total monthly donations exceed
$500 / month.

## Code of conduct enforcement

The project lead is the current enforcement contact (see
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)). As the maintainer team grows,
a rotating conduct committee will be established to remove single-person
liability and avoid conflicts of interest.

## Changing this document

This governance document is itself subject to the rules above. Material
changes require an RFC and 14 days of comment. Editorial changes (typos,
clarifications, link fixes) can be merged as routine PRs.
