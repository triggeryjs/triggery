import { useAction, useCondition, useEvent } from '@triggery/solid';
import { createSignal, For } from 'solid-js';
import { messageTrigger } from './triggers/index.ts';

export function App() {
  return (
    <main
      style={{
        'font-family': 'system-ui, sans-serif',
        padding: '24px',
        'max-width': '520px',
        margin: '0 auto',
      }}
    >
      <h1>Triggery — notifications (Solid)</h1>
      <Settings />
      <Chat />
      <Toasts />
    </main>
  );
}

function Settings() {
  const [enabled, setEnabled] = createSignal(true);
  useCondition(messageTrigger, 'settings', () => ({ notifications: enabled() }));
  return (
    <label style={{ display: 'block', margin: '8px 0' }}>
      <input
        type="checkbox"
        checked={enabled()}
        onInput={(e) => setEnabled(e.currentTarget.checked)}
      />{' '}
      Show toasts
    </label>
  );
}

function Chat() {
  const fire = useEvent(messageTrigger, 'new-message');
  return (
    <button type="button" onClick={() => fire({ author: 'Alice', text: 'hi from Solid' })}>
      Send message
    </button>
  );
}

function Toasts() {
  const [items, setItems] = createSignal<Array<{ id: string; title: string; body: string }>>([]);
  useAction(messageTrigger, 'showToast', (p) =>
    setItems((arr) => [{ id: crypto.randomUUID(), ...p }, ...arr].slice(0, 5)),
  );
  return (
    <ul style={{ 'list-style': 'none', padding: 0, 'margin-top': '16px' }}>
      <For each={items()}>
        {(t) => (
          <li
            style={{
              padding: '8px',
              'margin-bottom': '4px',
              background: '#f7f7f7',
              'border-radius': '6px',
            }}
          >
            <strong>{t.title}</strong>: {t.body}
          </li>
        )}
      </For>
    </ul>
  );
}
