# Triggery — analytics fan-out (Vite + React)

Producers fire one typed analytics event. Three reactors — Segment, Amplitude, GA4 — each own their SDK and decide independently whether they're active. Adding or removing a provider is one component, no rewiring.

```bash
pnpm install
pnpm dev
```
