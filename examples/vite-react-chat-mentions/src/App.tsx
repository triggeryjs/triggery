import { getDefaultRuntime } from '@triggery/core';
import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { type Mention, mentionTrigger } from './triggers/index.ts';

export function App() {
  const [webhookEnabled, setEnabled] = useState(true);
  useCondition(mentionTrigger, 'webhookEnabled', () => webhookEnabled, [webhookEnabled]);
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — chat mentions → webhook</h1>
      <p>
        A mention triggers an async webhook. The reactor fires a <em>follow-up event</em> with the
        result, which a second branch of the trigger turns into success/error toasts.
      </p>
      <label style={{ display: 'block', margin: '8px 0' }}>
        <input
          type="checkbox"
          checked={webhookEnabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{' '}
        Webhook integration enabled
      </label>
      <Producer />
      <MentionLog />
      <WebhookReactor />
      <Toasts />
    </main>
  );
}

function Producer() {
  const fire = useEvent(mentionTrigger, 'chat:mention');
  return (
    <button
      type="button"
      onClick={() => fire({ id: crypto.randomUUID(), user: '@alice', message: 'check this out' })}
    >
      Send mention
    </button>
  );
}

function MentionLog() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  useAction(mentionTrigger, 'appendMention', (m) => setMentions((arr) => [m, ...arr].slice(0, 5)));
  return (
    <section style={{ marginTop: 16 }}>
      <h3>Mentions</h3>
      <ul>
        {mentions.map((m) => (
          <li key={m.id}>
            {m.user}: {m.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

function WebhookReactor() {
  // The runtime is needed to fire a follow-up event from inside an action.
  // Using the default runtime keeps the example self-contained.
  const runtime = getDefaultRuntime();
  useAction(mentionTrigger, 'callWebhook', async (mention) => {
    // Simulate a real HTTP call to a webhook URL.
    await new Promise((r) => setTimeout(r, 500));
    const ok = Math.random() > 0.3;
    runtime.fire('chat:webhook-response', {
      id: mention.id,
      ok,
      reason: ok ? undefined : 'HTTP 503 from upstream',
    });
  });
  return null;
}

function Toasts() {
  const [items, setItems] = useState<Array<{ id: string; kind: 'ok' | 'err'; text: string }>>([]);
  useAction(mentionTrigger, 'toastSuccess', (text) =>
    setItems((arr) => [{ id: crypto.randomUUID(), kind: 'ok', text }, ...arr].slice(0, 5)),
  );
  useAction(mentionTrigger, 'toastError', (p) =>
    setItems((arr) =>
      [{ id: crypto.randomUUID(), kind: 'err', text: `${p.id}: ${p.reason}` }, ...arr].slice(0, 5),
    ),
  );
  return (
    <section style={{ marginTop: 16 }}>
      <h3>Toasts</h3>
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            padding: 8,
            marginBottom: 4,
            borderRadius: 4,
            background: t.kind === 'ok' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${t.kind === 'ok' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {t.text}
        </div>
      ))}
    </section>
  );
}
