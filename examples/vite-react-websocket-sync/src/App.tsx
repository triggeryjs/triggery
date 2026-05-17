import { useAction, useCondition, useEvent } from '@triggery/react';
import { useEffect, useState } from 'react';
import { wsMessageTrigger } from './triggers/index.ts';

type Message = { id: string; channelId: string; author: string; text: string };

export function App() {
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [dnd, setDnd] = useState(false);
  useCondition(wsMessageTrigger, 'activeChannelId', () => activeChannelId, [activeChannelId]);
  useCondition(wsMessageTrigger, 'dnd', () => dnd, [dnd]);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — WebSocket sync</h1>
      <p>
        Incoming WebSocket frames fan out: append to message cache, bump per-channel unread badge,
        toast (unless DND). Active channel and DND are owned by independent components.
      </p>
      <FakeSocket />
      <Tabs activeId={activeChannelId} onChange={setActiveChannelId} />
      <label style={{ display: 'block', margin: '8px 0' }}>
        <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} /> Do not
        disturb
      </label>
      <MessageList activeChannelId={activeChannelId} />
      <UnreadBadges />
      <ToastTray />
    </main>
  );
}

function FakeSocket() {
  const fire = useEvent(wsMessageTrigger, 'ws:new-message');
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      const channels = ['general', 'design', 'random'];
      const channel = channels[n % channels.length] ?? 'general';
      fire({
        id: crypto.randomUUID(),
        channelId: channel,
        author: ['Alice', 'Bob', 'Carol'][n % 3] ?? 'Alice',
        text: `Message #${n}`,
      });
    }, 2000);
    return () => clearInterval(id);
  }, [fire]);
  return <p style={{ fontSize: 12, opacity: 0.7 }}>(Fake WS firing every 2 s)</p>;
}

function Tabs({ activeId, onChange }: { activeId: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
      {['general', 'design', 'random'].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            padding: '6px 12px',
            background: activeId === id ? '#af37c5' : '#eee',
            color: activeId === id ? '#fff' : '#000',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          #{id}
        </button>
      ))}
    </div>
  );
}

function MessageList({ activeChannelId }: { activeChannelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  useAction(wsMessageTrigger, 'appendToCache', (msg) => {
    setMessages((m) => [...m, msg].slice(-30));
  });
  const visible = messages.filter((m) => m.channelId === activeChannelId);
  return (
    <section style={{ marginBottom: 16 }}>
      <h3>#{activeChannelId}</h3>
      <ul
        style={{
          listStyle: 'none',
          padding: 8,
          background: '#f7f7f7',
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        {visible.length === 0 && <li style={{ opacity: 0.6 }}>(no messages yet)</li>}
        {visible.map((m) => (
          <li key={m.id}>
            <strong>{m.author}:</strong> {m.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnreadBadges() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useAction(wsMessageTrigger, 'incrementUnread', (channelId) => {
    setCounts((c) => ({ ...c, [channelId]: (c[channelId] ?? 0) + 1 }));
  });
  return (
    <section style={{ marginBottom: 16 }}>
      <h4>Unread badges</h4>
      {Object.entries(counts).map(([id, n]) => (
        <span key={id} style={{ marginRight: 12 }}>
          #{id}: <strong>{n}</strong>
        </span>
      ))}
    </section>
  );
}

function ToastTray() {
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; body: string }>>([]);
  useAction(wsMessageTrigger, 'toast', (payload) => {
    setToasts((arr) => [{ id: crypto.randomUUID(), ...payload }, ...arr].slice(0, 5));
  });
  return (
    <section>
      <h4>Toasts (silenced by DND)</h4>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: 8,
            marginBottom: 4,
            background: '#fff8d6',
            border: '1px solid #e1c100',
            borderRadius: 4,
          }}
        >
          <strong>{t.title}</strong>: {t.body}
        </div>
      ))}
    </section>
  );
}
