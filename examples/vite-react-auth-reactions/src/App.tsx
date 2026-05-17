import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { authTrigger } from './triggers/index.ts';

export function App() {
  const [isDirty, setDirty] = useState(false);
  const [openRoutes, setOpenRoutes] = useState<string[]>(['/admin/users', '/billing/invoices']);
  const [redirectedTo, setRedirected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(0);
  const [toasts, setToasts] = useState<string[]>([]);

  useCondition(authTrigger, 'isDirty', () => isDirty, [isDirty]);
  useCondition(authTrigger, 'openRoutes', () => openRoutes, [openRoutes]);

  useAction(authTrigger, 'saveDraft', () => setDrafts((n) => n + 1));
  useAction(authTrigger, 'closeRoute', (r) => setOpenRoutes((arr) => arr.filter((x) => x !== r)));
  useAction(authTrigger, 'redirect', setRedirected);
  useAction(authTrigger, 'toast', (m) => setToasts((t) => [m, ...t].slice(0, 5)));

  const fireExpired = useEvent(authTrigger, 'auth:expired');
  const fireRevoked = useEvent(authTrigger, 'auth:role-revoked');

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — auth reactions</h1>
      <p>
        Two events: session expired and role revoked. One trigger decides what to do — save drafts,
        close dependent screens, redirect, toast — based on conditions registered by the rest of the
        app.
      </p>
      <label style={{ display: 'block', margin: '8px 0' }}>
        <input type="checkbox" checked={isDirty} onChange={(e) => setDirty(e.target.checked)} /> I
        have unsaved changes (`isDirty`)
      </label>
      <button type="button" onClick={() => fireExpired()}>
        Fire: session expired
      </button>{' '}
      <button type="button" onClick={() => fireRevoked('admin')}>
        Fire: admin role revoked
      </button>
      <h3>Open routes</h3>
      <ul>
        {openRoutes.length === 0 && <li style={{ opacity: 0.6 }}>(no open routes)</li>}
        {openRoutes.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p>Drafts saved: {drafts}</p>
      <p>Redirected to: {redirectedTo ?? '—'}</p>
      <h3>Toasts</h3>
      <ul>
        {toasts.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: demo only
          <li key={i}>{t}</li>
        ))}
      </ul>
    </main>
  );
}
