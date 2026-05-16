import { createRuntime, createTrigger, type TriggerInspectSnapshot } from '@triggery/core';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, type Ref } from 'vue';
import { TriggerRuntimeProvider, useInspect, useInspectHistory } from '../src/index.ts';

describe('@triggery/vue — useInspect / useInspectHistory', () => {
  it('useInspect returns a computed yielding the latest snapshot', () => {
    const runtime = createRuntime();
    const trigger = createTrigger<{ events: { tick: number } }>(
      {
        id: 'inspect-1',
        events: ['tick'],
        handler: () => {},
      },
      runtime,
    );

    let snap: { value: TriggerInspectSnapshot | undefined } = { value: undefined };
    const Probe = defineComponent({
      setup() {
        snap = useInspect(trigger);
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Probe) },
    });

    expect(snap.value).toBeUndefined();
    runtime.fireSync('tick', 1);
    expect(snap.value?.triggerId).toBe('inspect-1');
  });

  it('useInspectHistory exposes recent runs and stays in sync with the buffer', () => {
    const runtime = createRuntime();
    const trigger = createTrigger<{ events: { tick: number } }>(
      {
        id: 'inspect-history',
        events: ['tick'],
        handler: () => {},
      },
      runtime,
    );

    let history: Ref<readonly TriggerInspectSnapshot[]> | undefined;
    const Probe = defineComponent({
      setup() {
        history = useInspectHistory(20);
        return () => null;
      },
    });

    mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Probe) },
    });

    if (!history) throw new Error('history ref not captured');
    const ref = history;
    expect(ref.value.length).toBe(0);
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    expect(ref.value.length).toBe(3);
    expect(ref.value[0]?.triggerId).toBe(trigger.id);
  });
});
