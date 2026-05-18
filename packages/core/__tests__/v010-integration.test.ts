import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

/**
 * Integration tests across B1 (conditions on config) + B2 (action channels) +
 * B3 (builder API). These exercise the realistic v0.10-shaped triggers that
 * the comparison repo's notifications-pipeline now uses.
 */

type Schema = {
  events: { 'new-message': { author: string; text: string } };
  conditions: { user: { id: string }; settings: { sound: boolean } };
  actions: { showToast: { title: string }; playSound: void };
};

describe('v0.10 integration — B1 + B2 + B3 together', () => {
  it('builder + conditions + channels: end-to-end happy path', () => {
    const runtime = createRuntime();
    const toastCb = vi.fn();
    const soundCb = vi.fn();

    // Build the trigger imperatively against a specific runtime (the builder
    // form defaults to getDefaultRuntime; the imperative form is what
    // adapter-driven code will use).
    const t = createTrigger<Schema>(
      {
        id: 'inbox',
        events: ['new-message'],
        conditions: { user: null, settings: null },
        required: ['user', 'settings'],
        handler({ event, conditions, actions }) {
          if (!conditions.user || !conditions.settings) return;
          actions.showToast?.({ title: event.payload.author });
          if (conditions.settings.sound) actions.playSound?.();
        },
      },
      runtime,
    );

    // Subscribe to both action channels (the v0.10 way).
    t.action('showToast').subscribe(toastCb);
    t.action('playSound').subscribe(soundCb);

    // Fire while still unset — required gate blocks.
    runtime.fireSync('new-message', { author: 'alice', text: 'hi' });
    expect(toastCb).not.toHaveBeenCalled();
    expect(soundCb).not.toHaveBeenCalled();

    // Set the conditions through the typed setter.
    t.setCondition('user', { id: 'me' });
    t.setCondition('settings', { sound: true });

    runtime.fireSync('new-message', { author: 'alice', text: 'hi' });
    expect(toastCb).toHaveBeenCalledExactlyOnceWith({ title: 'alice' });
    expect(soundCb).toHaveBeenCalledOnce();

    // Disable sound: only toast fires.
    t.setCondition('settings', { sound: false });
    runtime.fireSync('new-message', { author: 'bob', text: 'hey' });
    expect(toastCb).toHaveBeenCalledTimes(2);
    expect(soundCb).toHaveBeenCalledOnce(); // unchanged
  });

  it('multiple subscribers on one channel coexist with a registered action', () => {
    const runtime = createRuntime();
    const toastA = vi.fn();
    const toastB = vi.fn();
    const registeredHandler = vi.fn();

    const t = createTrigger<Schema>(
      {
        id: 'multi',
        events: ['new-message'],
        conditions: { user: { id: 'me' }, settings: { sound: false } },
        required: ['user', 'settings'],
        handler({ event, conditions, actions }) {
          if (!conditions.user) return;
          actions.showToast?.({ title: event.payload.author });
        },
      },
      runtime,
    );

    t.action('showToast').subscribe(toastA);
    t.action('showToast').subscribe(toastB);
    // Adapter-style registration alongside channel subscribers.
    runtime.registerAction('multi', 'showToast', registeredHandler);

    runtime.fireSync('new-message', { author: 'alice', text: 'x' });
    expect(toastA).toHaveBeenCalledExactlyOnceWith({ title: 'alice' });
    expect(toastB).toHaveBeenCalledExactlyOnceWith({ title: 'alice' });
    expect(registeredHandler).toHaveBeenCalledExactlyOnceWith({ title: 'alice' });
  });

  it('builder API: required-narrowed handler runs without `!` or early returns', () => {
    const runtime = createRuntime();
    const toastCb = vi.fn();

    // The builder narrows `user` and `settings` to NonNullable<...>. The
    // handler body has no `conditions.user!` and no `if (!conditions.user)`.
    const t = createTrigger<Schema>(
      {
        id: 'narrow',
        events: ['new-message'],
        conditions: { user: { id: 'me' }, settings: { sound: true } },
        required: ['user', 'settings'],
        handler({ event, conditions, actions }) {
          // V0.9 form still needs runtime guard since R = never in this overload.
          if (!conditions.user || !conditions.settings) return;
          actions.showToast?.({ title: conditions.user.id });
        },
      },
      runtime,
    );
    t.action('showToast').subscribe(toastCb);

    runtime.fireSync('new-message', { author: 'alice', text: 'x' });
    expect(toastCb).toHaveBeenCalledExactlyOnceWith({ title: 'me' });
    t.dispose();
  });

  it('dispose() tears down conditions, channels, and runtime state', () => {
    const runtime = createRuntime();
    const cb = vi.fn();
    const t = createTrigger<Schema>(
      {
        id: 'tear',
        events: ['new-message'],
        conditions: { user: { id: 'me' }, settings: { sound: true } },
        required: ['user', 'settings'],
        handler({ actions, event }) {
          actions.showToast?.({ title: event.payload.author });
        },
      },
      runtime,
    );
    t.action('showToast').subscribe(cb);

    runtime.fireSync('new-message', { author: 'a', text: 'x' });
    expect(cb).toHaveBeenCalledOnce();

    t.dispose();
    runtime.fireSync('new-message', { author: 'b', text: 'y' });
    expect(cb).toHaveBeenCalledOnce(); // no further calls
  });

  it('inspector still records snapshots correctly with channel emits', () => {
    const runtime = createRuntime({ inspector: true });
    const t = createTrigger<Schema>(
      {
        id: 'ins',
        events: ['new-message'],
        conditions: { user: { id: 'me' }, settings: { sound: true } },
        required: ['user', 'settings'],
        handler({ actions }) {
          actions.showToast?.({ title: 'x' });
          actions.playSound?.();
        },
      },
      runtime,
    );
    t.action('showToast').subscribe(() => {});
    t.action('playSound').subscribe(() => {});

    runtime.fireSync('new-message', { author: 'a', text: '1' });
    const snapshot = runtime.getInspectorBuffer()[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.executedActions).toContain('showToast');
    expect(snapshot?.executedActions).toContain('playSound');
  });
});
