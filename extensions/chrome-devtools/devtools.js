// Register the Triggery panel in Chrome DevTools.
//
// `chrome.devtools.panels.create` runs once per DevTools window that opens
// against a tab. The panel HTML itself lives in panel.html / panel.js and
// owns the port-connect handshake with the service worker.
chrome.devtools.panels.create('Triggery', /* iconPath */ '', 'panel.html');
