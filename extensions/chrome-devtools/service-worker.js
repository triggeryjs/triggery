// Service worker (manifest v3 background) — routes triggery events between
// content scripts (one per tab) and DevTools panels (one per tab).
//
// Architecture:
//   page.runtime ──postMessage──▶ content-script ──sendMessage──▶ service worker
//                                                                       │
//                                                                       │ port.postMessage
//                                                                       ▼
//                                                               DevTools panel
//
// Panels open a long-lived port named `panel:<tabId>`. The service worker
// stores the port keyed by tabId. When a content script forwards an event,
// we look up the panel port by sender.tab.id and push the payload through.

/** Map<tabId, chrome.runtime.Port> — panel ports indexed by inspected-tab id. */
const panelPorts = new Map();

chrome.runtime.onConnect.addListener((port) => {
  // Expected port name is `panel:<tabId>`. Anything else we ignore.
  const match = /^panel:(\d+)$/.exec(port.name);
  if (!match) return;
  const tabId = Number(match[1]);
  panelPorts.set(tabId, port);
  port.onDisconnect.addListener(() => {
    if (panelPorts.get(tabId) === port) panelPorts.delete(tabId);
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.kind !== 'triggery-event') return;
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') return;
  const port = panelPorts.get(tabId);
  if (port) {
    try {
      port.postMessage(msg.payload);
    } catch {
      // Panel was closed between the lookup and the post — drop.
      panelPorts.delete(tabId);
    }
  }
});
