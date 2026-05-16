/**
 * Deterministic time controller for tests. Replaces global `setTimeout` /
 * `clearTimeout` with a virtual clock — pending timers don't fire until you
 * call `advance(ms)` or `flushAll()`. Useful for testing the
 * `actions.debounce / throttle / defer` wrappers without `await new
 * Promise(setTimeout, …)` flakes.
 *
 * Test-runner agnostic — no dependency on Vitest's `vi.useFakeTimers()` so it
 * also works in plain `node:test`, Jest, etc.
 *
 * @example
 * ```ts
 * const ft = createFakeScheduler();
 * ft.install();
 * try {
 *   rt.fire('tick');
 *   await ft.advance(500);   // run all timers due within 500ms
 *   expect(action).toHaveBeenCalledTimes(1);
 * } finally {
 *   ft.uninstall();
 * }
 * ```
 */
export interface FakeScheduler {
  /** Replace globalThis.setTimeout / clearTimeout with the fake controller. */
  install(): void;
  /** Restore the real timer functions. Safe to call multiple times. */
  uninstall(): void;
  /** Current virtual clock value, in ms since install. */
  now(): number;
  /**
   * Advance the virtual clock by `ms` and run every timer that becomes due in
   * that window. Returns a promise that resolves after pending microtasks are
   * drained, so callers can `await ft.advance(N)` and then assert.
   */
  advance(ms: number): Promise<void>;
  /**
   * Run every pending timer (regardless of its scheduled time). Useful for
   * "give up on the clock, just see what eventually happens".
   */
  flushAll(): Promise<void>;
  /** Number of timers still pending. */
  pending(): number;
}

interface PendingTimer {
  id: number;
  fn: () => void;
  runAt: number;
}

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export function createFakeScheduler(): FakeScheduler {
  const timers = new Map<number, PendingTimer>();
  let now = 0;
  let counter = 0;
  let installed = false;
  let originalSetTimeout: typeof globalThis.setTimeout | null = null;
  let originalClearTimeout: typeof globalThis.clearTimeout | null = null;

  function install(): void {
    if (installed) return;
    installed = true;
    originalSetTimeout = globalThis.setTimeout;
    originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = ((fn: () => void, ms: number = 0): TimerHandle => {
      const id = ++counter;
      timers.set(id, { id, fn, runAt: now + Math.max(0, ms) });
      return id as unknown as TimerHandle;
    }) as typeof globalThis.setTimeout;
    globalThis.clearTimeout = ((handle: TimerHandle | undefined): void => {
      if (handle == null) return;
      timers.delete(handle as unknown as number);
    }) as typeof globalThis.clearTimeout;
  }

  function uninstall(): void {
    if (!installed) return;
    installed = false;
    if (originalSetTimeout) globalThis.setTimeout = originalSetTimeout;
    if (originalClearTimeout) globalThis.clearTimeout = originalClearTimeout;
    originalSetTimeout = null;
    originalClearTimeout = null;
    timers.clear();
    now = 0;
    counter = 0;
  }

  async function advance(ms: number): Promise<void> {
    if (ms < 0) throw new Error('[triggery/testing] advance(): ms must be >= 0');
    const target = now + ms;
    // Drain in-order across the advance; new timers scheduled during a callback
    // count if their runAt falls within `target`.
    while (true) {
      const due = [...timers.values()].filter((t) => t.runAt <= target);
      if (due.length === 0) break;
      due.sort((a, b) => a.runAt - b.runAt || a.id - b.id);
      const next = due[0] as PendingTimer;
      timers.delete(next.id);
      now = next.runAt;
      try {
        next.fn();
      } catch (err) {
        // eslint-disable-next-line no-console -- surface to test output
        console.error('[triggery/testing] fakeScheduler timer threw:', err);
      }
    }
    now = target;
    // Drain microtasks twice — handlers may queue follow-ups.
    await Promise.resolve();
    await Promise.resolve();
  }

  async function flushAll(): Promise<void> {
    while (timers.size > 0) {
      const sorted = [...timers.values()].sort((a, b) => a.runAt - b.runAt || a.id - b.id);
      const next = sorted[0] as PendingTimer;
      timers.delete(next.id);
      now = Math.max(now, next.runAt);
      try {
        next.fn();
      } catch (err) {
        // eslint-disable-next-line no-console -- surface to test output
        console.error('[triggery/testing] fakeScheduler timer threw:', err);
      }
    }
    await Promise.resolve();
    await Promise.resolve();
  }

  return {
    install,
    uninstall,
    now: () => now,
    advance,
    flushAll,
    pending: () => timers.size,
  };
}
