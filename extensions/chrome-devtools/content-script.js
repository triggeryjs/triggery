// Content script — runs in the isolated world of every matched page.
//
// Listens for postMessage envelopes from `@triggery/devtools-bridge` (which
// runs in the page's main world) and forwards them to the extension's
// service worker. The service worker fans them out to whichever DevTools
// panel is attached to this tab.
//
// We don't subscribe to the runtime directly from here — the isolated world
// can't reach the page's JS objects. The page-side bridge is what publishes
// the events; we just relay.

const SOURCE = 'triggery-devtools';

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.source !== SOURCE) return;
  // Forward into the extension; service worker picks it up.
  try {
    chrome.runtime.sendMessage({ kind: 'triggery-event', payload: data });
  } catch {
    // Extension might be reloading / context invalidated — ignore.
  }
});
