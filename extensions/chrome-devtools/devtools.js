// Register a Triggery panel inside Chrome DevTools.
// V1 stub: the panel is a static informational page. The content-script
// bridge that pipes runtime events from the inspected page to the panel
// lands in V1.1 — tracked alongside `@triggery/devtools-panel`.
chrome.devtools.panels.create('Triggery', 'icons/icon48.png', 'panel.html', () => {
  // No-op for now. In V1.1 we open a long-lived connection here:
  //   const port = chrome.runtime.connect({ name: 'triggery-panel' });
  //   port.onMessage.addListener(...);
});
