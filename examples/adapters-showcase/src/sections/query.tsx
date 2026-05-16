import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createTrigger } from '@triggery/core';
import { useQueryCondition } from '@triggery/query';
import { useAction, useEvent } from '@triggery/react';
import { useState } from 'react';

type User = { id: number; name: string };

const fetchUser = async (): Promise<User> => {
  await new Promise((r) => setTimeout(r, 250));
  return { id: 1, name: 'Ada' };
};

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { user: User };
  actions: { say: string };
}>({
  id: 'query-greet',
  events: ['greet'],
  required: ['user'],
  handler({ event, conditions, actions }) {
    actions.say?.(`Hello ${conditions.user.name} at ${event.payload} — TanStack Query!`);
  },
});

export function QuerySection() {
  return (
    <section>
      <h2>TanStack Query adapter</h2>
      <p>
        <code>useQueryCondition</code> reads the query cache (<code>queryClient.getQueryData</code>)
        at fire time. The trigger only runs once the cache has the entry — perfect for "fire after
        load" scenarios.
      </p>
      <Loader />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function Loader() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['user'], queryFn: fetchUser });
  useQueryCondition(greetTrigger, 'user', qc, ['user']);
  return (
    <p style={{ color: '#666' }}>
      {isLoading ? 'Loading user…' : `Loaded user: ${data?.name ?? '—'}`}
    </p>
  );
}

function GreetButton() {
  const fire = useEvent(greetTrigger, 'greet');
  return (
    <button type="button" onClick={() => fire(new Date().toLocaleTimeString())}>
      Greet
    </button>
  );
}

function GreetingDisplay() {
  const [last, setLast] = useState<string | null>(null);
  useAction(greetTrigger, 'say', (text) => setLast(text));
  return last ? <p style={paragraph}>{last}</p> : null;
}

const paragraph = { marginTop: 12, padding: 10, background: '#eef', borderRadius: 6 } as const;
