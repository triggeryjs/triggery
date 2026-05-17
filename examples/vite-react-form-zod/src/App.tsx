import { useAction, useEvent } from '@triggery/react';
import { useState } from 'react';
import { type FormPayload, formTrigger } from './triggers/index.ts';

// Inline mini-validator — same Result shape as Standard Schema / zod parse.
// In a real app you'd import zod / valibot / arktype here.
function parse(input: {
  email: unknown;
  age: unknown;
}): { ok: true; data: FormPayload } | { ok: false; issues: Record<string, string> } {
  const issues: Record<string, string> = {};
  const email = String(input.email ?? '').trim();
  const age = Number(input.age);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.email = 'Must be an email';
  if (!Number.isFinite(age) || age < 13 || age > 120) issues.age = 'Must be 13–120';
  if (Object.keys(issues).length > 0) return { ok: false, issues };
  return { ok: true, data: { email, age } };
}

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — form with producer-side validation</h1>
      <p>
        The form parses input through a Standard-Schema-shaped validator before firing the event.
        The trigger handler sees only valid, typed payload — no runtime surprises.
      </p>
      <ProfileForm />
      <ProfileStore />
    </main>
  );
}

function ProfileForm() {
  const fire = useEvent(formTrigger, 'form:submitted');
  const [email, setEmail] = useState('alice@example.com');
  const [age, setAge] = useState('25');
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = parse({ email, age });
        if (!r.ok) {
          setErrors(r.issues);
          return;
        }
        setErrors({});
        fire(r.data);
      }}
      style={{ display: 'grid', gap: 8, marginBottom: 24 }}
    >
      <label>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 4 }}
        />
        {errors.email && <small style={{ color: 'crimson' }}>{errors.email}</small>}
      </label>
      <label>
        Age
        <input
          value={age}
          onChange={(e) => setAge(e.target.value)}
          style={{ width: '100%', padding: 4 }}
        />
        {errors.age && <small style={{ color: 'crimson' }}>{errors.age}</small>}
      </label>
      <button type="submit">Submit</button>
    </form>
  );
}

function ProfileStore() {
  const [saved, setSaved] = useState<FormPayload[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  useAction(formTrigger, 'saveProfile', (p) => setSaved((s) => [...s, p]));
  useAction(formTrigger, 'toast', (m) => setToasts((t) => [m, ...t].slice(0, 5)));
  return (
    <section>
      <h3>Saved profiles</h3>
      <ul>
        {saved.map((p) => (
          <li key={p.email}>
            {p.email} ({p.age})
          </li>
        ))}
      </ul>
      <h3>Toasts</h3>
      <ul>
        {toasts.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
