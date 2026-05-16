import { useState } from 'react';
import { DomSection } from './sections/dom.tsx';
import { JotaiSection } from './sections/jotai.tsx';
import { MobxSection } from './sections/mobx.tsx';
import { QuerySection } from './sections/query.tsx';
import { ReatomSection } from './sections/reatom.tsx';
import { ReduxSection } from './sections/redux.tsx';
import { SignalsSection } from './sections/signals.tsx';
import { SocketSection } from './sections/socket.tsx';
import { ZustandSection } from './sections/zustand.tsx';

const TABS = [
  { id: 'zustand', label: 'Zustand', Component: ZustandSection },
  { id: 'redux', label: 'Redux', Component: ReduxSection },
  { id: 'jotai', label: 'Jotai', Component: JotaiSection },
  { id: 'mobx', label: 'MobX', Component: MobxSection },
  { id: 'reatom', label: 'Reatom', Component: ReatomSection },
  { id: 'signals', label: 'Signals', Component: SignalsSection },
  { id: 'query', label: 'TanStack Query', Component: QuerySection },
  { id: 'dom', label: 'DOM events', Component: DomSection },
  { id: 'socket', label: 'WebSocket', Component: SocketSection },
] as const;

export function App() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('zustand');
  const Section = TABS.find((t) => t.id === active)?.Component ?? ZustandSection;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        minHeight: '100vh',
      }}
    >
      <aside style={{ borderRight: '1px solid #e5e7eb', padding: 16, background: '#fafafa' }}>
        <h1 style={{ fontSize: 16, marginTop: 0 }}>Triggery adapters</h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                border: '1px solid transparent',
                borderRadius: 6,
                background: active === t.id ? '#2563eb' : 'transparent',
                color: active === t.id ? '#fff' : '#111',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <main style={{ padding: 24, maxWidth: 640 }}>
        <Section />
      </main>
    </div>
  );
}
