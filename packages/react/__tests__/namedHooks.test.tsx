import { render } from '@testing-library/react';
import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNamedHooks, TriggerRuntimeProvider } from '../src/index.ts';

type Schema = {
  events: { ping: number };
  conditions: { token: string };
  actions: { use: number };
};

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('createNamedHooks', () => {
  it('synthesises usePingEvent / useTokenCondition / useUseAction', async () => {
    activeRuntime = createRuntime();
    const trigger = createTrigger<Schema>(
      {
        id: 'named',
        events: ['ping'],
        required: ['token'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.token) return;
          actions.use?.(event.payload);
        },
      },
      activeRuntime,
    );

    const hooks = createNamedHooks(trigger);
    const spy = vi.fn();

    const Provider = () => {
      hooks.useTokenCondition(() => 'ok');
      return null;
    };
    const Action = () => {
      hooks.useUseAction(spy);
      return null;
    };
    const Source = () => {
      const fire = hooks.usePingEvent();
      useEffect(() => {
        fire(42);
      }, [fire]);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <Provider />
        <Action />
        <Source />
      </TriggerRuntimeProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledExactlyOnceWith(42);
  });
});
