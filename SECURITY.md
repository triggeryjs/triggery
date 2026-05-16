# Security Policy

## Supported Versions

Triggery is pre-1.0 software. Only the latest minor version on the `main` branch
receives security fixes. Once 1.0 ships this policy will be revised to follow
semver-based support windows.

| Version | Supported          |
| ------- | ------------------ |
| `0.x`   | Latest minor only  |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security problems.

Use one of the following private channels:

1. **GitHub Security Advisories** (preferred) —
   <https://github.com/triggeryjs/triggery/security/advisories/new>.
   Allows coordinated disclosure, CVE assignment and patched-release planning.
2. **Email** — `a@skhom.ru` with subject `[triggery security]`.
   PGP key on request.

You can expect:

- An acknowledgement within **3 business days**.
- A triage assessment within **7 business days** (severity, affected versions,
  estimated remediation timeline).
- Coordinated disclosure once a fix is available, including credit in the
  advisory (unless you prefer to remain anonymous).

## Scope

In scope:

- Any package published under the `@triggery/*` npm scope.
- The Vite plugin (`@triggery/vite`).
- The Chrome DevTools extension shipped from `extensions/chrome-devtools`.
- The default runtime behaviour described in the public docs.

Out of scope:

- Third-party adapters not maintained in this repository.
- Issues that require a malicious local environment (e.g. compromised
  `node_modules`).
- Denial-of-service caused by deliberately misconfigured user code (e.g.
  unbounded cascade depth set by the integrator).

## Hall of Fame

Reporters who follow responsible disclosure will be acknowledged in
[`SECURITY-CREDITS.md`](./SECURITY-CREDITS.md) (created once the first
advisory is published).
