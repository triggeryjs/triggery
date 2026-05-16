// Panel — renders the live inspector list for the inspected tab.
//
// Opens a long-lived port to the service worker named `panel:<tabId>`. The
// service worker keeps a map of these and forwards every triggery message
// that comes in from the inspected page's content script.

const tabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: `panel:${tabId}` });

const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const runtimeIdLabel = document.getElementById('runtime-id');
const counter = document.getElementById('counter');
const clearBtn = document.getElementById('clear');
const root = document.getElementById('root');

const MAX_RUNS = 500;
/** @type {Array<{ snapshot: import('@triggery/core').TriggerInspectSnapshot; at: number }>} */
const runs = [];

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderRow(entry, index) {
  const s = entry.snapshot;
  const actions =
    s.executedActions && s.executedActions.length > 0
      ? `<span class="actions">→ ${escapeHtml(s.executedActions.join(', '))}</span>`
      : '<span></span>';
  const reason = s.reason ? `<span class="reason">(${escapeHtml(s.reason)})</span>` : '';
  return `
    <li>
      <div class="row" data-index="${index}">
        <span class="status-tag ${s.status}">${escapeHtml(s.status)}</span>
        <span class="duration">${Number(s.durationMs).toFixed(2)}ms</span>
        <span><span class="trigger">${escapeHtml(s.triggerId)}</span> <span class="event">← ${escapeHtml(s.eventName)}</span> ${reason}</span>
        ${actions}
        <span class="duration">${escapeHtml(s.runId)}</span>
      </div>
    </li>
  `;
}

function render() {
  counter.textContent = `${runs.length} run${runs.length === 1 ? '' : 's'}`;
  if (runs.length === 0) {
    root.innerHTML = `
      <div class="empty">
        Waiting for the page to call <code>installDevtoolsBridge(runtime)</code>…
      </div>`;
    return;
  }
  root.innerHTML = `<ul class="runs">${runs.map(renderRow).join('')}</ul>`;
  for (const rowEl of root.querySelectorAll('.row')) {
    rowEl.addEventListener('click', () => {
      const idx = Number(rowEl.dataset.index);
      const li = rowEl.parentElement;
      const existing = li.querySelector('details');
      if (existing) {
        existing.remove();
        return;
      }
      const detailsEl = document.createElement('details');
      detailsEl.open = true;
      const json = JSON.stringify(runs[idx].snapshot, null, 2);
      detailsEl.innerHTML = `<summary>snapshot</summary><pre>${escapeHtml(json)}</pre>`;
      li.appendChild(detailsEl);
    });
  }
}

function setConnected(connected, label) {
  statusDot.classList.toggle('connected', connected);
  statusLabel.textContent = label;
}

clearBtn.addEventListener('click', () => {
  runs.length = 0;
  render();
});

port.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'triggery:hello': {
      runtimeIdLabel.textContent = `runtime: ${msg.runtimeId}`;
      setConnected(true, 'connected');
      runs.length = 0;
      if (Array.isArray(msg.buffer)) {
        // Buffer is newest-first; flip so the most recent ends up at the top
        // after we unshift via push order.
        for (const snapshot of [...msg.buffer].reverse()) {
          runs.unshift({ snapshot, at: msg.at });
          if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
        }
      }
      render();
      break;
    }
    case 'triggery:snapshot': {
      runs.unshift({ snapshot: msg.snapshot, at: msg.at });
      if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
      render();
      break;
    }
    case 'triggery:bye': {
      setConnected(false, 'runtime disposed');
      break;
    }
    default:
      break;
  }
});

port.onDisconnect.addListener(() => setConnected(false, 'disconnected'));
