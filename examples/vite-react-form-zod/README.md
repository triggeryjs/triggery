# Triggery — form validation at the producer boundary (Vite + React)

The form parses input through a Standard-Schema-shaped validator before firing the trigger event. The handler sees only fully-typed, validated payload — no try/catch in the rule itself.

The example uses an inline mini-validator to keep the dependency footprint zero, but you can plug in `zod` / `valibot` / `arktype` with the same `parse()` shape.

## Try it

- **Open in StackBlitz** — <https://triggeryjs.github.io/play/vite-react-form-zod/>
- **Read the recipe** — <https://triggeryjs.github.io/recipes/react/form-with-zod/>

Or run it locally:

```bash
pnpm install
pnpm dev
```
