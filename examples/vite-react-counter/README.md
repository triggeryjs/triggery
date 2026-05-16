# Triggery — counter example (Vite + React)

The smallest possible Triggery scenario:

| Port      | Role                          | Component       |
| --------- | ----------------------------- | --------------- |
| `event`     | `increment` (button click)    | `<Counter />`         |
| `condition` | `enabled` (feature toggle)    | `<Settings />`        |
| `action`    | `notify` (render the result) | `<NotificationBar />` |

The trigger itself lives in `src/triggers/notification.trigger.ts` and reads
like a spec.

## Try it

- **StackBlitz** — <https://stackblitz.com/github/triggeryjs/triggery/tree/main/examples/vite-react-counter>
- **CodeSandbox** — <https://codesandbox.io/p/github/triggeryjs/triggery/main?path=%2Fexamples%2Fvite-react-counter>

Or locally:

```bash
git clone https://github.com/triggeryjs/triggery
cd triggery
pnpm install
pnpm --filter triggery-example-vite-react-counter dev
```

Open <http://localhost:5173>.

## Where to look next

- [`src/triggers/notification.trigger.ts`](./src/triggers/notification.trigger.ts) — the scenario in one file.
- [`src/App.tsx`](./src/App.tsx) — three components plug into named ports, no shared store.
- [Main README](../../README.md) — the full pitch and links to every package.
