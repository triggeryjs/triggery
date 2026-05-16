import { createRuntime, createTrigger } from '@triggery/core';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import {
  TriggerRuntimeProvider,
  TriggerScope,
  useAction,
  useCondition,
  useEvent,
} from '../src/index.ts';

type Settings = { sound: boolean; theme: 'light' | 'dark' };

type Schema = {
  events: { tick: number; reset: void };
  conditions: { settings: Settings };
  actions: { record: { kind: 'tick' | 'reset'; payload?: unknown } };
};

function setupTrigger() {
  const runtime = createRuntime();
  const fired: { kind: string; payload?: unknown }[] = [];
  const trigger = createTrigger<Schema>(
    {
      id: 'vue-bindings',
      events: ['tick', 'reset'],
      required: ['settings'],
      handler({ event, conditions, actions }) {
        if (!conditions.settings) return;
        if (event.name === 'tick') actions.record?.({ kind: 'tick', payload: event.payload });
        if (event.name === 'reset') actions.record?.({ kind: 'reset' });
      },
    },
    runtime,
  );
  runtime.registerAction('vue-bindings', 'record', (p) => {
    fired.push(p as { kind: string; payload?: unknown });
  });
  return { runtime, trigger, fired };
}

afterEach(() => {
  // mount() instances are unmounted via wrapper.unmount() inside each test
  // where it matters; this hook is here for future setup.
});

describe('@triggery/vue', () => {
  it('useEvent returns a function that fires the event (via microtask scheduler)', async () => {
    const { runtime, trigger, fired } = setupTrigger();

    const Tester = defineComponent({
      setup() {
        useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
        const fire = useEvent(trigger, 'tick');
        fire(7);
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Tester) },
    });

    // Default scheduler is `microtask` — flush before asserting.
    await Promise.resolve();
    expect(fired).toEqual([{ kind: 'tick', payload: 7 }]);
  });

  it('useCondition reads the latest ref value at fire time', () => {
    const { runtime, trigger, fired } = setupTrigger();
    const settings = ref<Settings>({ sound: true, theme: 'light' });

    const Provider = defineComponent({
      setup() {
        useCondition(trigger, 'settings', () => settings.value);
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Provider) },
    });

    runtime.fireSync('tick', 1);
    expect(fired).toEqual([{ kind: 'tick', payload: 1 }]);

    settings.value = { sound: false, theme: 'dark' };
    runtime.fireSync('tick', 2);
    expect(fired).toEqual([
      { kind: 'tick', payload: 1 },
      { kind: 'tick', payload: 2 },
    ]);
  });

  it('useAction handler runs when the trigger body invokes it', () => {
    const { runtime, trigger } = setupTrigger();
    const calls: number[] = [];

    const Slot = defineComponent({
      setup() {
        useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
        useAction(trigger, 'record', (p) => {
          if ((p as { kind: string }).kind === 'tick') calls.push(p.payload as number);
        });
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Slot) },
    });

    runtime.fireSync('tick', 100);
    expect(calls).toEqual([100]);
  });

  it('unregisters on unmount via onScopeDispose', () => {
    const { runtime, trigger, fired } = setupTrigger();

    const Provider = defineComponent({
      setup() {
        useCondition(trigger, 'settings', () => ({ sound: true, theme: 'light' as const }));
        return () => null;
      },
    });

    const wrapper = mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Provider) },
    });

    runtime.fireSync('tick', 1);
    expect(fired).toHaveLength(1);

    wrapper.unmount();
    runtime.fireSync('tick', 2);
    // After unmount the required condition is gone — handler skipped.
    expect(fired).toHaveLength(1);
  });

  it('TriggerScope provides a scope id to descendants', () => {
    const runtime = createRuntime();
    const fired: number[] = [];
    const scopedTrigger = createTrigger<{
      events: { tick: number };
      conditions: { v: number };
      actions: { record: number };
    }>(
      {
        id: 'scoped',
        scope: 'chat',
        events: ['tick'],
        required: ['v'],
        handler({ event, conditions, actions }) {
          if (conditions.v === undefined) return;
          actions.record?.(event.payload + conditions.v);
        },
      },
      runtime,
    );

    const Provider = defineComponent({
      setup() {
        useCondition(scopedTrigger, 'v', () => 10);
        useAction(scopedTrigger, 'record', (n) => {
          fired.push(n as number);
        });
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: {
        default: () => h(TriggerScope, { id: 'chat' }, { default: () => h(Provider) }),
      },
    });

    runtime.fireSync('tick', 5);
    expect(fired).toEqual([15]);
  });

  it('throws when used outside <TriggerRuntimeProvider>', () => {
    const Bad = defineComponent({
      setup() {
        useEvent({ id: 'x' } as never, 'tick' as never);
        return () => null;
      },
    });

    expect(() => mount(Bad)).toThrowError(/TriggerRuntimeProvider|provideTriggerRuntime/);
  });
});
