import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { notificationTrigger } from './triggers/notification.trigger.ts';

/**
 * Three independent components glued together via the trigger:
 *
 *   <Counter />        emits the event       (useEvent)
 *   <Settings />       provides the gate     (useCondition)
 *   <NotificationBar /> renders the result   (useAction)
 *
 * No prop drilling, no useEffect chains, no shared store — just three
 * triggery hooks.
 */
export function App() {
  return (
    <main
      style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 480, margin: '0 auto' }}
    >
      <h1>Triggery — counter example</h1>
      <p>
        Click <strong>Increment</strong>. If <em>"Show notifications"</em> is on, you'll see a
        notification appear. Toggle it off, click again — silence.
      </p>
      <Settings />
      <Counter />
      <NotificationBar />
      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.6 }}>
        Powered by <a href="https://github.com/triggeryjs/triggery">@triggery/core</a> +{' '}
        <a href="https://github.com/triggeryjs/triggery/tree/main/packages/react">
          @triggery/react
        </a>
        .
      </footer>
    </main>
  );
}

function Settings() {
  const [enabled, setEnabled] = useState(true);
  useCondition(notificationTrigger, 'enabled', () => enabled, [enabled]);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{' '}
      Show notifications
    </label>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  const fire = useEvent(notificationTrigger, 'increment');
  return (
    <button
      type="button"
      onClick={() => {
        const next = count + 1;
        setCount(next);
        fire(next);
      }}
      style={{ padding: '8px 16px', fontSize: 16, cursor: 'pointer' }}
    >
      Increment ({count})
    </button>
  );
}

function NotificationBar() {
  const [last, setLast] = useState<{ count: number } | null>(null);
  useAction(notificationTrigger, 'notify', (payload) => setLast(payload));
  if (!last) return null;
  return (
    <p
      style={{
        marginTop: 16,
        padding: 12,
        background: '#e6f4ea',
        border: '1px solid #b7dfbf',
        borderRadius: 8,
      }}
    >
      Counter reached <strong>{last.count}</strong>
    </p>
  );
}
