// V1 stub: no content-script bridge yet. The placeholder UI lives in panel.html.
// In V1.1 this script will:
//   1. Open a long-lived `chrome.runtime.connect({ name: 'triggery-panel' })`
//      connection back to the extension's service worker.
//   2. Render an `InspectorView`-shaped UI from a vendored React bundle.
//   3. Forward keyboard shortcuts (filter, clear, copy run).
