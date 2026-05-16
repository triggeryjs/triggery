/**
 * @triggery/react — React bindings for Triggery.
 *
 * Public entry points:
 *   - `useEvent(trigger, 'eventName')` — typed event emitter.
 *   - `useCondition(trigger, 'name', getter, deps?)` — pull-based condition.
 *   - `useAction(trigger, 'name', handler)` — register an executor.
 *   - `useInspect(trigger)` — latest trigger snapshot (for debugging).
 *   - `<TriggerRuntimeProvider runtime={...}>` — inject a custom runtime.
 *
 * Triggers are created with `createTrigger` from `@triggery/core`. The hooks take the
 * trigger object as their first argument — stable identity, no string lookups.
 */

export { TriggerRuntimeContext, useRuntime } from './context.ts';
export { useAction, useCondition, useEvent, useInspect } from './hooks.ts';
export {
  TriggerRuntimeProvider,
  type TriggerRuntimeProviderProps,
} from './TriggerRuntimeProvider.tsx';
