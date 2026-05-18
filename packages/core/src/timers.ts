/**
 * Timer wrappers for `actions.debounce / throttle / defer` — extracted into
 * their own module so that handler code which never reaches for the
 * chainable timers gets them tree-shaken out of the main bundle. The proxy
 * factory in `dispatch.ts` only references this module behind a property
 * access on the `actions` object, which bundlers (esbuild, swc, rollup)
 * detect as a lazy boundary when both modules are part of the same
 * package.
 */

/**
 * One pending or in-flight timer for an action. Stored per-trigger on
 * `RegisteredTrigger.timers`, keyed by `${kind}:${action}:${ms|counter}`.
 */
export type TimerEntry =
  | { kind: 'debounce'; tid: ReturnType<typeof setTimeout> }
  | { kind: 'throttle'; lastFiredAt: number }
  | { kind: 'defer'; tid: ReturnType<typeof setTimeout> };

/** Carrier of the per-trigger timer state — mirrors `RegisteredTrigger`. */
export type TimerCarrier = {
  readonly timers: Map<string, TimerEntry>;
  deferCounter: number;
};

const nowMs = (): number => Date.now();

/** Cancel and drop every pending timer for a carrier. Called on dispose. */
export function cancelAllTimers(carrier: TimerCarrier): void {
  for (const entry of carrier.timers.values()) {
    if (entry.kind === 'debounce' || entry.kind === 'defer') {
      clearTimeout(entry.tid);
    }
  }
  carrier.timers.clear();
}

/**
 * Build the lazy proxy returned by `actions.debounce(ms)` / `.throttle(ms)` /
 * `.defer(ms)`. The returned object is a `Proxy` over the action map:
 *   - `obj.X(payload)` schedules an invocation of the action `X` per `kind`+`ms`
 *   - `obj.X` is `undefined` if neither a registered handler nor channel
 *     subscriber exists for that name
 *
 * The proxy is only created when a handler accesses one of the three
 * timer entry points; common-case handlers that call `actions.X(payload)`
 * directly never allocate it.
 */
export function buildTimedActionsProxy(deps: {
  kind: 'debounce' | 'throttle' | 'defer';
  ms: number;
  carrier: TimerCarrier;
  hasTarget(name: string): boolean;
  callDeferred(name: string, payload: unknown): void;
}): Record<string, ((payload?: unknown) => void) | undefined> {
  const { kind, ms, carrier, hasTarget, callDeferred } = deps;
  return new Proxy({} as Record<string, ((payload?: unknown) => void) | undefined>, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (!hasTarget(prop)) return undefined;
      return (payload?: unknown) => {
        if (kind === 'debounce') {
          const key = `debounce:${prop}:${ms}`;
          const existing = carrier.timers.get(key);
          if (existing?.kind === 'debounce') clearTimeout(existing.tid);
          const tid = setTimeout(() => {
            carrier.timers.delete(key);
            callDeferred(prop, payload);
          }, ms);
          carrier.timers.set(key, { kind: 'debounce', tid });
        } else if (kind === 'throttle') {
          // Leading-edge throttle: fire immediately, drop calls until `ms`
          // has elapsed. Trailing-edge variant is roadmapped.
          const key = `throttle:${prop}:${ms}`;
          const existing = carrier.timers.get(key);
          const now = nowMs();
          if (existing?.kind === 'throttle' && now - existing.lastFiredAt < ms) return;
          carrier.timers.set(key, { kind: 'throttle', lastFiredAt: now });
          callDeferred(prop, payload);
        } else {
          const key = `defer:${prop}:${++carrier.deferCounter}`;
          const tid = setTimeout(() => {
            carrier.timers.delete(key);
            callDeferred(prop, payload);
          }, ms);
          carrier.timers.set(key, { kind: 'defer', tid });
        }
      };
    },
    has(_target, prop) {
      return typeof prop === 'string' && hasTarget(prop);
    },
  });
}
