import { render } from '@testing-library/react';
import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TriggerRuntimeProvider, useAction, useCondition, useEvent } from '../src/index.ts';

type Schema = {
  events: { notify: string };
  conditions: { user: { id: string } };
  actions: { show: string };
};

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('@triggery/react — smoke', () => {
  it('end-to-end: useEvent → handler → useAction', async () => {
    activeRuntime = createRuntime();
    const showSpy = vi.fn();

    const trigger = createTrigger<Schema>(
      {
        id: 'smoke',
        events: ['notify'],
        required: ['user'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.user) return;
          actions.show?.(`${conditions.user.id}:${event.payload}`);
        },
      },
      activeRuntime,
    );

    const Provider = ({ children }: { children: React.ReactNode }) => {
      useCondition(trigger, 'user', () => ({ id: 'alice' }));
      return <>{children}</>;
    };

    const Toast = () => {
      useAction(trigger, 'show', showSpy);
      return null;
    };

    const Trigger = () => {
      const fire = useEvent(trigger, 'notify');
      useEffect(() => {
        fire('hello');
      }, [fire]);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <Provider>
          <Toast />
          <Trigger />
        </Provider>
      </TriggerRuntimeProvider>,
    );

    // Microtask scheduler — wait for flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(showSpy).toHaveBeenCalledExactlyOnceWith('alice:hello');
  });

  it('unmount: condition/action unregister cleanly', async () => {
    activeRuntime = createRuntime();
    const showSpy = vi.fn();

    const trigger = createTrigger<Schema>(
      {
        id: 'unmount',
        events: ['notify'],
        required: ['user'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.user) return;
          actions.show?.(`${conditions.user.id}:${event.payload}`);
        },
      },
      activeRuntime,
    );

    const Provider = () => {
      useCondition(trigger, 'user', () => ({ id: 'bob' }));
      return null;
    };
    const Toast = () => {
      useAction(trigger, 'show', showSpy);
      return null;
    };

    const { unmount } = render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <Provider />
        <Toast />
      </TriggerRuntimeProvider>,
    );
    // Sanity — everything works right after mount.
    activeRuntime.fireSync('notify', 'first');
    expect(showSpy).toHaveBeenCalledExactlyOnceWith('bob:first');

    unmount();

    // After unmount no listener must receive the event.
    activeRuntime.fireSync('notify', 'after-unmount');
    expect(showSpy).toHaveBeenCalledTimes(1);
  });
});
