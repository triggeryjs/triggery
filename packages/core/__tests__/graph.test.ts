import { describe, expect, it } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

describe('runtime.graph()', () => {
  it('empty runtime returns no triggers and an empty event index', () => {
    const runtime = createRuntime();
    expect(runtime.graph()).toEqual({ triggers: [], eventIndex: {} });
  });

  it('captures id, scope, events, required, schedule, concurrency, enabled', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { tick: number }; conditions: { user: { id: string } } }>(
      {
        id: 'demo',
        events: ['tick'],
        required: ['user'],
        scope: 'chat',
        schedule: 'sync',
        concurrency: 'queue',
        handler() {},
      },
      runtime,
    );
    const g = runtime.graph();
    expect(g.triggers).toEqual([
      {
        id: 'demo',
        scope: 'chat',
        events: ['tick'],
        required: ['user'],
        schedule: 'sync',
        concurrency: 'queue',
        enabled: true,
      },
    ]);
    expect(g.eventIndex).toEqual({ tick: ['demo'] });
  });

  it('reflects multiple triggers sharing an event in the event index', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { tick: void } }>({ id: 'a', events: ['tick'], handler() {} }, runtime);
    createTrigger<{ events: { tick: void } }>({ id: 'b', events: ['tick'], handler() {} }, runtime);
    const g = runtime.graph();
    expect(g.triggers.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect([...(g.eventIndex['tick'] ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('disabled triggers appear with enabled=false but stay indexed', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { tick: void } }>(
      { id: 'disabled', events: ['tick'], handler() {} },
      runtime,
    );
    t.disable();
    const node = runtime.graph().triggers[0];
    expect(node?.enabled).toBe(false);
  });

  it('disposed triggers disappear from graph + event index', () => {
    const runtime = createRuntime();
    const t = createTrigger<{ events: { tick: void } }>(
      { id: 'gone', events: ['tick'], handler() {} },
      runtime,
    );
    t.dispose();
    expect(runtime.graph()).toEqual({ triggers: [], eventIndex: {} });
  });
});
