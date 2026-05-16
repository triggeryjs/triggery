import { QueryClient } from '@tanstack/query-core';
import { cleanup, render } from '@testing-library/react';
import { createRuntime, createTrigger } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useQueryCondition } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

type User = { id: string; name: string };

type Schema = {
  events: { tick: void };
  conditions: { user: User };
  actions: { record: User };
};

function setupTrigger() {
  const runtime = createRuntime();
  const fired: User[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'query-test',
      events: ['tick'],
      required: ['user'],
      handler: ({ conditions, actions }) => {
        if (!conditions.user) return;
        actions.record?.(conditions.user);
      },
    },
    runtime,
  );
  runtime.registerAction('query-test', 'record', (payload) => {
    fired.push(payload as User);
  });
  return { runtime, trigger, fired };
}

function Wrapper({
  runtime,
  children,
}: {
  runtime: ReturnType<typeof createRuntime>;
  children: ReactNode;
}) {
  return <TriggerRuntimeProvider runtime={runtime}>{children}</TriggerRuntimeProvider>;
}

describe('@triggery/query', () => {
  it('reads cached query data at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const qc = new QueryClient();
    qc.setQueryData<User>(['user', 'current'], { id: 'u1', name: 'Alice' });

    function Bridge() {
      useQueryCondition<User, Schema, 'user'>(trigger, 'user', qc, ['user', 'current']);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([{ id: 'u1', name: 'Alice' }]);

    qc.setQueryData<User>(['user', 'current'], { id: 'u2', name: 'Bob' });
    runtime.fireSync('tick');
    expect(fired).toEqual([
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ]);
  });

  it('returns undefined for missing entries, so required-gate skips cleanly', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const qc = new QueryClient();
    // No data seeded.

    function Bridge() {
      useQueryCondition<User, Schema, 'user'>(trigger, 'user', qc, ['user', 'current']);
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toEqual([]);

    qc.setQueryData<User>(['user', 'current'], { id: 'u1', name: 'Alice' });
    runtime.fireSync('tick');
    expect(fired).toEqual([{ id: 'u1', name: 'Alice' }]);
  });

  it('supports a selector for projection', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const qc = new QueryClient();
    qc.setQueryData<{ user: User; ts: number }>(['profile', 'current'], {
      user: { id: 'u1', name: 'Alice' },
      ts: 0,
    });

    function Bridge() {
      useQueryCondition<{ user: User; ts: number }, Schema, 'user'>(
        trigger,
        'user',
        qc,
        ['profile', 'current'],
        (d) => d?.user,
      );
      return null;
    }

    render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired[0]).toEqual({ id: 'u1', name: 'Alice' });
  });

  it('unregisters on unmount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const qc = new QueryClient();
    qc.setQueryData<User>(['user', 'current'], { id: 'u1', name: 'Alice' });

    function Bridge() {
      useQueryCondition<User, Schema, 'user'>(trigger, 'user', qc, ['user', 'current']);
      return null;
    }

    const { unmount } = render(
      <Wrapper runtime={runtime}>
        <Bridge />
      </Wrapper>,
    );

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);

    unmount();
    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);
  });

  it('survives StrictMode double-mount', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const qc = new QueryClient();
    qc.setQueryData<User>(['user', 'current'], { id: 'u1', name: 'Alice' });

    function Bridge() {
      useQueryCondition<User, Schema, 'user'>(trigger, 'user', qc, ['user', 'current']);
      return null;
    }

    render(
      <StrictMode>
        <Wrapper runtime={runtime}>
          <Bridge />
        </Wrapper>
      </StrictMode>,
    );

    runtime.fireSync('tick');
    expect(fired).toHaveLength(1);
  });
});
