import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { messageTrigger } from './triggers/index.ts';

type Settings = { sound: boolean; notifications: boolean; dnd: boolean };

const CURRENT_USER = 'me';

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — notifications pipeline</h1>
      <p>
        Three independent reactors (toast, sound badge, channel badge) coordinated by one trigger.
        Send a fake message and watch them fire — toggle settings to see the gates.
      </p>
      <SettingsPanel />
      <ChatPanel activeChannelId="general" />
      <NotificationLayer />
      <BadgePanel />
      <SoundLog />
    </main>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    sound: true,
    notifications: true,
    dnd: false,
  });
  useCondition(messageTrigger, 'settings', () => settings, [settings]);

  const toggle = (k: keyof Settings) => setSettings((s) => ({ ...s, [k]: !s[k] }));

  return (
    <fieldset style={{ marginBottom: 16 }}>
      <legend>Settings</legend>
      <label style={{ marginRight: 16 }}>
        <input
          type="checkbox"
          checked={settings.notifications}
          onChange={() => toggle('notifications')}
        />{' '}
        Show toasts
      </label>
      <label style={{ marginRight: 16 }}>
        <input type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} /> Sound
      </label>
      <label>
        <input type="checkbox" checked={settings.dnd} onChange={() => toggle('dnd')} /> Do not
        disturb
      </label>
    </fieldset>
  );
}

function ChatPanel({ activeChannelId }: { activeChannelId: string }) {
  useCondition(messageTrigger, 'activeChannelId', () => activeChannelId, [activeChannelId]);
  useCondition(messageTrigger, 'currentUserId', () => CURRENT_USER, []);

  const fire = useEvent(messageTrigger, 'new-message');

  return (
    <section style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() =>
          fire({
            id: crypto.randomUUID(),
            author: 'Alice',
            authorId: 'alice',
            text: 'hi from #design',
            channelId: 'design',
          })
        }
      >
        Send fake message in #design
      </button>{' '}
      <button
        type="button"
        onClick={() =>
          fire({
            id: crypto.randomUUID(),
            author: 'me',
            authorId: CURRENT_USER,
            text: 'echo from myself',
            channelId: 'general',
          })
        }
      >
        Send from myself (will be ignored)
      </button>
      <p style={{ fontSize: 12, opacity: 0.7 }}>Active channel: {activeChannelId}</p>
    </section>
  );
}

function NotificationLayer() {
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; body: string }>>([]);
  useAction(messageTrigger, 'showToast', (payload) => {
    setToasts((arr) => [{ id: crypto.randomUUID(), ...payload }, ...arr].slice(0, 5));
  });
  return (
    <section style={{ marginBottom: 16 }}>
      <h3>Toasts</h3>
      {toasts.length === 0 && <p style={{ opacity: 0.6 }}>(no toasts yet)</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {toasts.map((t) => (
          <li
            key={t.id}
            style={{
              padding: 8,
              marginBottom: 4,
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#f7f7f7',
            }}
          >
            <strong>{t.title}</strong>: {t.body}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BadgePanel() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useAction(messageTrigger, 'incrementBadge', (channelId) => {
    setCounts((c) => ({ ...c, [channelId]: (c[channelId] ?? 0) + 1 }));
  });
  return (
    <section style={{ marginBottom: 16 }}>
      <h3>Unread badges</h3>
      {Object.keys(counts).length === 0 && <p style={{ opacity: 0.6 }}>(no unread)</p>}
      <ul>
        {Object.entries(counts).map(([ch, n]) => (
          <li key={ch}>
            #{ch}: <strong>{n}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SoundLog() {
  const [beeps, setBeeps] = useState<string[]>([]);
  useAction(messageTrigger, 'playSound', (sound) => {
    setBeeps((b) => [`${new Date().toLocaleTimeString()} ${sound}`, ...b].slice(0, 5));
  });
  return (
    <section>
      <h3>Sound log (debounced 800 ms)</h3>
      {beeps.length === 0 && <p style={{ opacity: 0.6 }}>(silence)</p>}
      <ul>
        {beeps.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </section>
  );
}
