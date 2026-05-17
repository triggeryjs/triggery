# Triggery DevTools — manual smoke test

Standalone HTML page that wires `@triggery/devtools-bridge` to a runtime and exposes buttons for every panel-relevant scenario (sync fire, async, cascade, skipped, errored, dispose).

> **Not runnable in StackBlitz.** This example requires the unpacked Chrome extension from `extensions/chrome-devtools/`, so the `/play/devtools-smoke/` launcher is intentionally omitted. Run it locally instead.
>
> - **Bridge package** — <https://triggeryjs.github.io/packages/devtools-bridge/>
> - **Panel package** — <https://triggeryjs.github.io/packages/devtools-panel/>

## Run it

From the repo root:

```bash
pnpm build               # make sure packages/*/dist exist
python3 -m http.server 8000
```

Then in Chrome:

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → select `extensions/chrome-devtools/`.
2. Open <http://localhost:8000/examples/devtools-smoke/>.
3. Open DevTools (`⌥⌘I` / `Ctrl+Shift+I`) → switch to the **Triggery** panel.
4. Click any button — the run shows up in the panel within a few ms.

## What each button should produce in the panel

| Button | Expected panel row |
|---|---|
| `fireSync tick` | `fired demo ← tick → notify` |
| `fire tick (async)` | Same as above, after a microtask tick |
| `cascade: a → b` | Two rows: `fired t-a ← a → goB` + `fired t-b ← b` |
| `fire secure (skipped)` | `skipped secure ← secure (missing-required-condition:session)` |
| `register session condition` | (no panel row — registration only) — next `fire secure` will say `fired` |
| `unregister session` | (no panel row) — `fire secure` returns to skipped |
| `fire boom (errored)` | `errored boom ← boom` |
| `dispose bridge` | Status dot in panel header goes grey; further events stop appearing |

Click any row in the panel to expand the full JSON snapshot.
