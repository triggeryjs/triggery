# Triggery DevTools — Chrome extension (V1 stub)

Minimal scaffold for a Chrome DevTools panel. Load it as an unpacked extension to verify wiring:

1. `chrome://extensions` → toggle **Developer mode** → **Load unpacked** → select this directory.
2. Open DevTools on any page → a **Triggery** panel appears alongside Elements / Console.

The panel currently shows a static placeholder. The content-script bridge that streams runtime events from the inspected page lands in **V1.1** — until then use the in-app `<InspectorView />` from [`@triggery/devtools-panel`](../../packages/devtools-panel) or the [`reduxDevtoolsMiddleware`](../../packages/devtools-redux) for Redux DevTools.

## Files

| File | Role |
|---|---|
| `manifest.json` | Manifest V3 declaration, `devtools_page` points at `devtools.html` |
| `devtools.html` + `devtools.js` | Registers the **Triggery** panel via `chrome.devtools.panels.create` |
| `panel.html` + `panel.js` | The panel UI itself (static for now) |
| `icons/icon{16,48,128}.png` | Toolbar / panel icons — drop your own PNGs in place |

## Roadmap (V1.1)

* Service worker that injects a content script into the inspected page.
* Content script subscribes to the page's runtime via `runtime.subscribe()` and forwards snapshots over `chrome.runtime.connect`.
* Panel renders the live inspector list (vendored React bundle of `@triggery/devtools-panel`).
