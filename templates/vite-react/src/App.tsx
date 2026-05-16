import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { welcomeTrigger } from './triggers/welcome.trigger.ts';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Triggery starter</h1>
      <p>
        Click <strong>Greet</strong>. If <em>"Be friendly"</em> is on, you'll see a greeting appear.
        Toggle it off, click again — silence. The whole scenario lives in
        <code> src/triggers/welcome.trigger.ts</code>.
      </p>
      <FriendlinessToggle />
      <GreetButton />
      <GreetingDisplay />
    </main>
  );
}

function FriendlinessToggle() {
  const [friendly, setFriendly] = useState(true);
  useCondition(welcomeTrigger, 'friendly', () => friendly, [friendly]);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input type="checkbox" checked={friendly} onChange={(e) => setFriendly(e.target.checked)} />
      Be friendly
    </label>
  );
}

function GreetButton() {
  const fire = useEvent(welcomeTrigger, 'greet');
  return (
    <button
      type="button"
      onClick={() => fire(new Date().toLocaleTimeString())}
      style={{ padding: '8px 16px', fontSize: 16, cursor: 'pointer' }}
    >
      Greet
    </button>
  );
}

function GreetingDisplay() {
  const [last, setLast] = useState<string | null>(null);
  useAction(welcomeTrigger, 'say', (text) => setLast(text));
  if (!last) return null;
  return (
    <p
      style={{
        marginTop: 16,
        padding: 12,
        background: '#eef',
        border: '1px solid #bbd',
        borderRadius: 8,
      }}
    >
      {last}
    </p>
  );
}
