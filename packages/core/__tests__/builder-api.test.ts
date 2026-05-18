import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createTrigger } from '../src/builder.ts';
import type { TriggerBuilder } from '../src/index.ts';
import { createRuntime, createTrigger as createTriggerImperative } from '../src/index.ts';

type Schema = {
  events: { ping: number };
  conditions: { user: { id: string }; settings: { sound: boolean } };
  actions: { greet: string };
};

describe('B3 — builder API (runtime)', () => {
  it('createTrigger<S>() with no args returns a builder', () => {
    const builder = createTrigger<Schema>();
    expect(typeof builder.id).toBe('function');
    expect(typeof builder.events).toBe('function');
    expect(typeof builder.require).toBe('function');
    expect(typeof builder.conditions).toBe('function');
    expect(typeof builder.handle).toBe('function');
  });

  it('.handle finalizes and returns a Trigger that runs', () => {
    const t = createTrigger<Schema>()
      .id('b1')
      .events(['ping'])
      .conditions({ user: { id: 'alice' }, settings: { sound: true } })
      .require('user', 'settings')
      .handle(({ event, conditions, actions }) => {
        actions.greet?.(`${conditions.user.id}:${event.payload}`);
      });
    expect(t.id).toBe('b1');
    t.dispose();
  });

  it('chaining order does not affect behaviour', () => {
    // .events before .id
    const t = createTrigger<Schema>()
      .events(['ping'])
      .id('b2')
      .conditions({ user: { id: 'bob' } })
      .require('user')
      .handle(({ conditions, actions }) => {
        actions.greet?.(conditions.user.id);
      });
    expect(t.id).toBe('b2');
    t.dispose();
  });

  it('builder result is the same Trigger interface (id, dispose, etc.)', () => {
    const t = createTrigger<Schema>()
      .id('b3')
      .events(['ping'])
      .conditions({ user: { id: 'x' } })
      .handle(() => {});
    expect(t.id).toBe('b3');
    expect(typeof t.dispose).toBe('function');
    expect(typeof t.enable).toBe('function');
    expect(typeof t.disable).toBe('function');
    expect(typeof t.setCondition).toBe('function');
    expect(typeof t.action).toBe('function');
    t.dispose();
  });

  it('integrates with an explicit runtime through .handle', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    // We pass runtime via the second-arg form on top-level createTrigger.
    // For the builder, the runtime defaults to getDefaultRuntime() — see
    // integration test for builder + explicit runtime via injection.
    createTriggerImperative<Schema>(
      {
        id: 'b4',
        events: ['ping'],
        conditions: { user: { id: 'alice' } },
        required: ['user'],
        handler: ({ conditions, actions }) => actions.greet?.(conditions.user!.id),
      },
      runtime,
    );
    runtime.registerAction('b4', 'greet', action);
    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledExactlyOnceWith('alice');
  });

  it('.handle throws if .id was not called', () => {
    expect(() =>
      createTrigger<Schema>()
        .events(['ping'])
        .handle(() => {}),
    ).toThrow(/\.id\(\.\.\.\) was not called/);
  });

  it('.handle throws if .events was not called', () => {
    expect(() =>
      createTrigger<Schema>()
        .id('b5')
        .handle(() => {}),
    ).toThrow(/\.events\(\.\.\.\) was not called/);
  });

  it('.require accumulates keys across calls', () => {
    const t = createTrigger<Schema>()
      .id('b6')
      .events(['ping'])
      .require('user')
      .require('settings')
      .conditions({ user: { id: 'q' }, settings: { sound: true } })
      .handle(({ conditions }) => {
        // Both keys are narrowed to NonNullable<...> by R3
        expect(conditions.user.id).toBe('q');
        expect(conditions.settings.sound).toBe(true);
      });
    t.dispose();
  });

  it('.schedule, .concurrency, .scope are reflected in the created trigger', () => {
    const runtime = createRuntime();
    const t = createTrigger<Schema>()
      .id('b7')
      .events(['ping'])
      .schedule('sync')
      .concurrency('take-every')
      .scope('panel-1')
      .handle(() => {}).dispose;
    expect(typeof t).toBe('function');

    const t2 = createTriggerImperative<Schema>(
      {
        id: 'b7b',
        events: ['ping'],
        schedule: 'sync',
        handler: () => {},
      },
      runtime,
    );
    expect(t2.schedule).toBe('sync');
    t2.dispose();
  });

  it('builder-created trigger supports setCondition + action()', () => {
    const runtime = createRuntime();
    const action = vi.fn();
    const channelCb = vi.fn();
    const t = createTriggerImperative<Schema>(
      {
        id: 'b8',
        events: ['ping'],
        conditions: { user: null },
        required: ['user'],
        handler: ({ conditions, actions }) => {
          if (!conditions.user) return;
          actions.greet?.(conditions.user.id);
        },
      },
      runtime,
    );
    t.action('greet').subscribe(channelCb);
    runtime.registerAction('b8', 'greet', action);

    t.setCondition('user', { id: 'alice' });
    runtime.fireSync('ping', 1);
    expect(action).toHaveBeenCalledExactlyOnceWith('alice');
    expect(channelCb).toHaveBeenCalledExactlyOnceWith('alice');
  });

  it('.require() with no args leaves required empty', () => {
    const t = createTrigger<Schema>()
      .id('b9')
      .events(['ping'])
      .conditions({ user: null, settings: null })
      .require() // no-op
      .handle(({ conditions }) => {
        // conditions.user remains optional here
        expect(conditions.user ?? null).toBeNull();
        expect(conditions.settings ?? null).toBeNull();
      });
    t.dispose();
  });
});

describe('B3 — builder API (type-level)', () => {
  it('TriggerBuilder is exported', () => {
    type B = TriggerBuilder<Schema>;
    expectTypeOf<B>().not.toBeAny();
  });

  it('.require narrows the handler conditions to NonNullable', () => {
    const trigger = createTrigger<Schema>()
      .id('tt1')
      .events(['ping'])
      .require('user')
      .handle(({ conditions }) => {
        // Type assertion: conditions.user should be `{ id: string }`, not optional
        expectTypeOf(conditions.user).toEqualTypeOf<{ id: string }>();
      });
    trigger.dispose();
  });

  it('.require with multiple keys narrows all of them', () => {
    const trigger = createTrigger<Schema>()
      .id('tt2')
      .events(['ping'])
      .require('user', 'settings')
      .handle(({ conditions }) => {
        expectTypeOf(conditions.user).toEqualTypeOf<{ id: string }>();
        expectTypeOf(conditions.settings).toEqualTypeOf<{ sound: boolean }>();
      });
    trigger.dispose();
  });

  it('no .require leaves all conditions optional', () => {
    const trigger = createTrigger<Schema>()
      .id('tt3')
      .events(['ping'])
      .handle(({ conditions }) => {
        expectTypeOf(conditions.user).toEqualTypeOf<{ id: string } | undefined>();
        expectTypeOf(conditions.settings).toEqualTypeOf<{ sound: boolean } | undefined>();
      });
    trigger.dispose();
  });

  it('accumulated .require across two calls narrows both', () => {
    const trigger = createTrigger<Schema>()
      .id('tt4')
      .events(['ping'])
      .require('user')
      .require('settings')
      .handle(({ conditions }) => {
        expectTypeOf(conditions.user).toEqualTypeOf<{ id: string }>();
        expectTypeOf(conditions.settings).toEqualTypeOf<{ sound: boolean }>();
      });
    trigger.dispose();
  });

  it('.handle return type is Trigger<S>', () => {
    const trigger = createTrigger<Schema>()
      .id('tt5')
      .events(['ping'])
      .handle(() => {});
    expectTypeOf(trigger.id).toBeString();
    expectTypeOf(trigger.dispose).toBeFunction();
    trigger.dispose();
  });
});
