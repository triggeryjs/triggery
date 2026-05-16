import type { NamedHooks, Trigger, TriggerSchema } from '@triggery/core';
import { useAction, useCondition, useEvent } from './hooks.ts';

/**
 * Build the named-hooks proxy for a trigger.
 *
 * For a schema with `events: { 'new-message' }`, `conditions: { user }` and
 * `actions: { showToast }` this returns:
 *
 *   useNewMessageEvent      -> () => fire
 *   useUserCondition        -> (getter, deps?) => void
 *   useShowToastAction      -> (handler) => void
 *
 * Names are derived from string keys via `kebab-case -> PascalCase`:
 *   - `'new-message'`  -> `useNewMessageEvent`
 *   - `'user'`         -> `useUserCondition`
 *   - `'showToast'`    -> `useShowToastAction`
 *
 * Use it like:
 *
 *   export const { useNewMessageEvent, useUserCondition, useShowToastAction } =
 *     createNamedHooks(messageTrigger);
 *
 * Implementation detail: the underlying object is a `Proxy` keyed by the hook
 * name. Each lookup synthesizes a hook that delegates to `useEvent` /
 * `useCondition` / `useAction` with the right port name.
 */
export function createNamedHooks<S extends TriggerSchema>(trigger: Trigger<S>): NamedHooks<S> {
  // Cache hooks per identifier so React doesn't see a new function reference
  // every render (which would break hook-rules + cause unnecessary churn).
  const cache = new Map<string, unknown>();

  return new Proxy({} as NamedHooks<S>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      const cached = cache.get(prop);
      if (cached) return cached;

      const parsed = parseHookName(prop);
      if (!parsed) return undefined;

      const { kind, portName } = parsed;
      // biome-ignore lint/suspicious/noExplicitAny: bridge layer
      let hook: any;
      if (kind === 'event') {
        hook = () =>
          // biome-ignore lint/suspicious/noExplicitAny: passthrough
          useEvent(trigger as Trigger<S>, portName as any);
      } else if (kind === 'condition') {
        hook = (
          // biome-ignore lint/suspicious/noExplicitAny: passthrough
          getter: any,
          deps?: readonly unknown[],
        ) =>
          // biome-ignore lint/suspicious/noExplicitAny: passthrough
          useCondition(trigger as Trigger<S>, portName as any, getter, deps);
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: passthrough
        hook = (handler: any) =>
          // biome-ignore lint/suspicious/noExplicitAny: passthrough
          useAction(trigger as Trigger<S>, portName as any, handler);
      }
      cache.set(prop, hook);
      return hook;
    },
    has(_target, prop) {
      return typeof prop === 'string' && parseHookName(prop) !== null;
    },
  });
}

type ParsedHook = {
  kind: 'event' | 'condition' | 'action';
  /** Port name back in original camelCase/kebab-case form (best-effort). */
  portName: string;
};

const SUFFIXES = {
  event: 'Event',
  condition: 'Condition',
  action: 'Action',
} as const;

function parseHookName(hookName: string): ParsedHook | null {
  if (!hookName.startsWith('use')) return null;
  for (const [kind, suffix] of Object.entries(SUFFIXES) as [
    keyof typeof SUFFIXES,
    (typeof SUFFIXES)[keyof typeof SUFFIXES],
  ][]) {
    if (!hookName.endsWith(suffix)) continue;
    const middle = hookName.slice(3, hookName.length - suffix.length);
    if (middle.length === 0) continue;
    return { kind, portName: pascalToCamel(middle) };
  }
  return null;
}

/**
 * Convert PascalCase back to camelCase. We don't try to round-trip kebab-case
 * (`'new-message'` -> `'newMessage'`) because keys in `createTrigger` schemas
 * can be either form, and the runtime stores them as the original string.
 *
 * For kebab-case keys, the user can fall back to the universal `useEvent(t, 'kebab-key')`
 * hook — named-hooks support is best-effort for camelCase keys.
 */
function pascalToCamel(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
