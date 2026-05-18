import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';

describe('warn-once on last-mount collision (DEV)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when a second condition is registered for the same name', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void }; conditions: { user: { id: string } } }>(
      { id: 'collide', events: ['go'], handler() {} },
      runtime,
    );
    runtime.registerCondition('collide', 'user', () => ({ id: 'A' }));
    expect(warnSpy).not.toHaveBeenCalled();
    runtime.registerCondition('collide', 'user', () => ({ id: 'B' }));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('multiple condition registrations for "user"');
    expect(message).toContain('last write wins');
  });

  it('does not warn again for the same trigger/name pair', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void }; conditions: { x: number } }>(
      { id: 'silent', events: ['go'], handler() {} },
      runtime,
    );
    runtime.registerCondition('silent', 'x', () => 1);
    runtime.registerCondition('silent', 'x', () => 2);
    runtime.registerCondition('silent', 'x', () => 3);
    runtime.registerCondition('silent', 'x', () => 4);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT warn for StrictMode mount→unmount→mount (slot is empty on remount)', () => {
    const runtime = createRuntime();
    createTrigger<{ events: { go: void }; conditions: { x: number } }>(
      { id: 'sm', events: ['go'], handler() {} },
      runtime,
    );
    const first = runtime.registerCondition('sm', 'x', () => 1);
    first.unregister();
    runtime.registerCondition('sm', 'x', () => 2);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns separately per (label, name) pair', () => {
    const runtime = createRuntime();
    createTrigger<{
      events: { go: void };
      conditions: { a: number };
      actions: { b: void };
    }>({ id: 'multi', events: ['go'], handler() {} }, runtime);
    runtime.registerCondition('multi', 'a', () => 1);
    runtime.registerCondition('multi', 'a', () => 2);
    runtime.registerAction('multi', 'b', () => {});
    runtime.registerAction('multi', 'b', () => {});
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const messages = warnSpy.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(messages.some((m: string) => m.includes('condition'))).toBe(true);
    expect(messages.some((m: string) => m.includes('action'))).toBe(true);
  });

  it('separate runtimes have isolated warn caches', () => {
    const a = createRuntime();
    const b = createRuntime();
    createTrigger<{ events: { go: void }; conditions: { x: number } }>(
      { id: 'iso', events: ['go'], handler() {} },
      a,
    );
    createTrigger<{ events: { go: void }; conditions: { x: number } }>(
      { id: 'iso', events: ['go'], handler() {} },
      b,
    );
    a.registerCondition('iso', 'x', () => 1);
    a.registerCondition('iso', 'x', () => 2);
    b.registerCondition('iso', 'x', () => 10);
    b.registerCondition('iso', 'x', () => 20);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
