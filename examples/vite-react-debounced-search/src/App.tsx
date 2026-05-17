import { useAction, useEvent } from '@triggery/react';
import { useEffect, useRef, useState } from 'react';
import { type Hit, searchTrigger } from './triggers/index.ts';

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — debounced search</h1>
      <p>
        Type fast — only the last query in a 300 ms window fires. Each new query <code>abort</code>s
        the previous fetch via <code>signal</code>.
      </p>
      <SearchBox />
      <ResultList />
    </main>
  );
}

function SearchBox() {
  const fire = useEvent(searchTrigger, 'search-query');
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fire(text), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, fire]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Search…"
      style={{ width: '100%', padding: 8, fontSize: 16, marginBottom: 16 }}
    />
  );
}

function ResultList() {
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  useAction(searchTrigger, 'setResults', setHits);
  useAction(searchTrigger, 'setStatus', setStatus);
  return (
    <section>
      <p style={{ opacity: 0.7 }}>
        {status === 'loading'
          ? 'Searching…'
          : status === 'error'
            ? 'Error'
            : `${hits.length} results`}
      </p>
      <ul>
        {hits.map((h) => (
          <li key={h.id}>{h.label}</li>
        ))}
      </ul>
    </section>
  );
}
