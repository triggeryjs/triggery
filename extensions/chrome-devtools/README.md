# Triggery DevTools — Chrome extension

Live inspector for [Triggery](https://github.com/triggeryjs/triggery) runtimes, attached to Chrome DevTools.

Status: **functional V1**. Streams every run from the inspected page into a DevTools panel; click a row to see the full snapshot.

## Load it (5 minutes, end-to-end)

1. Wire the bridge into your app (one-time, DEV-only):

   ```ts
   import { createRuntime } from '@triggery/core';
   import { installDevtoolsBridge } from '@triggery/devtools-bridge';

   const runtime = createRuntime();
   if (import.meta.env.DEV) installDevtoolsBridge(runtime);
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions`.
   - Toggle **Developer mode** (top-right).
   - Click **Load unpacked** → select this directory (`extensions/chrome-devtools`).

3. Open your app. Open DevTools (`⌥⌘I` / `Ctrl+Shift+I`). The **Triggery** panel sits next to **Elements / Console**.

4. Fire an event from the app — it shows up in the panel within a few ms.

## What you see

* Status dot — green when the page has called `installDevtoolsBridge`.
* Run counter, runtime id.
* Each row: status, duration, `triggerId ← eventName (skip-reason?) → executedActions`, runId.
* Click a row → JSON snapshot.
* Clear button to drop the local view (page-side history is untouched).

## Architecture

```
page                 isolated world           extension
─────────────────    ──────────────────       ───────────────────
runtime
  │ subscribe
  ▼
@triggery/devtools-bridge
  │ window.postMessage
  ▼
window listener (in content-script.js)
                                    │ chrome.runtime.sendMessage
                                    ▼
                              service-worker.js
                                    │ port.postMessage (per-tab)
                                    ▼
                              panel.js  ──renders→  panel.html
```

The wire format is the `DevtoolsMessage` union from [`@triggery/devtools-bridge`](../../packages/devtools-bridge). The panel doesn't import any Triggery package — it speaks the protocol directly, so it works against any page that ships the bridge.

## Files

| File | Role |
|---|---|
| `manifest.json` | Manifest v3 — content script + service worker + devtools page |
| `content-script.js` | Forwards `window.postMessage` envelopes from the page-side bridge into the extension |
| `service-worker.js` | Per-tab router — keeps a `Map<tabId, panel port>` and pushes events through |
| `devtools.html` / `devtools.js` | Registers the **Triggery** panel via `chrome.devtools.panels.create` |
| `panel.html` / `panel.js` | The panel itself — connects back to the service worker as `panel:<tabId>`, renders incoming snapshots to DOM |

## Roadmap

V1.1: per-trigger filters, time-travel replay via `@triggery/devtools-replay`, cascade-tree view. Vanilla DOM rendering stays — Chrome extension panels are isolated enough that the simplicity of plain JS beats bundling React.
