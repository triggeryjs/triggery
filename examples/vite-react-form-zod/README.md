# Triggery — form validation at the producer boundary (Vite + React)

The form parses input through a Standard-Schema-shaped validator before firing the trigger event. The handler sees only fully-typed, validated payload — no try/catch in the rule itself.

The example uses an inline mini-validator to keep the dependency footprint zero, but you can plug in `zod` / `valibot` / `arktype` with the same `parse()` shape.

```bash
pnpm install
pnpm dev
```
