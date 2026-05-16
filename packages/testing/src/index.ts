/**
 * @triggery/testing — testing utilities for Triggery.
 *
 * The kit lets you write trigger tests without React, mocking conditions and
 * actions against an isolated runtime instead of relying on `getDefaultRuntime`.
 *
 * @example
 * ```ts
 * import { createTrigger } from '@triggery/core';
 * import { createTestRuntime } from '@triggery/testing';
 *
 * const rt = createTestRuntime();
 * const t = createTrigger<{
 *   events: { tick: number };
 *   conditions: { enabled: boolean };
 *   actions: { log: number };
 * }>(
 *   {
 *     id: 'demo',
 *     events: ['tick'],
 *     required: ['enabled'],
 *     handler: ({ event, conditions, actions }) => {
 *       if (!conditions.enabled) return;
 *       actions.log?.(event.payload);
 *     },
 *   },
 *   rt,
 * );
 *
 * rt.mockCondition(t, 'enabled', true);
 * const log = vi.fn();
 * rt.mockAction(t, 'log', log);
 *
 * rt.fireSync('tick', 42);
 * expect(log).toHaveBeenCalledWith(42);
 * ```
 */

import type {
  ActionFn,
  ActionKey,
  ActionMap,
  ConditionGetter,
  ConditionKey,
  ConditionMap,
  RegistrationToken,
  Runtime,
  RuntimeOptions,
  Trigger,
  TriggerSchema,
  UntypedActionFn,
} from '@triggery/core';
import { createRuntime } from '@triggery/core';

export type TestRuntimeOptions = RuntimeOptions;

export type TestRuntime = Runtime & {
  /**
   * Register a condition for a trigger.
   *
   * Accepts either a static value or a zero-argument getter. When the
   * condition's value type is itself a zero-argument function, pass an
   * explicit getter so the runtime knows which one you mean — otherwise the
   * heuristic below would call your value as if it were the getter.
   */
  mockCondition<S extends TriggerSchema, K extends ConditionKey<S>>(
    trigger: Trigger<S>,
    name: K,
    valueOrGetter: ConditionMap<S>[K] | (() => ConditionMap<S>[K]),
  ): RegistrationToken;

  /** Register an action handler — typically a `vi.fn()`. */
  mockAction<S extends TriggerSchema, K extends ActionKey<S>>(
    trigger: Trigger<S>,
    name: K,
    handler: ActionFn<ActionMap<S>[K]>,
  ): RegistrationToken;

  /**
   * Flush pending microtasks. The default scheduler uses `queueMicrotask` —
   * after `rt.fire(...)` you await `flushMicrotasks()` before asserting.
   *
   * `fireSync` does not need this: it runs handlers immediately.
   */
  flushMicrotasks(): Promise<void>;
};

type AnyFn = (...args: never[]) => unknown;
const isLikelyGetter = (fn: AnyFn): boolean => fn.length === 0;

export function createTestRuntime(options: TestRuntimeOptions = {}): TestRuntime {
  const runtime = createRuntime(options);

  const mockCondition = <S extends TriggerSchema, K extends ConditionKey<S>>(
    trigger: Trigger<S>,
    name: K,
    valueOrGetter: ConditionMap<S>[K] | (() => ConditionMap<S>[K]),
  ): RegistrationToken => {
    const getter: ConditionGetter =
      typeof valueOrGetter === 'function' && isLikelyGetter(valueOrGetter as AnyFn)
        ? (valueOrGetter as ConditionGetter)
        : () => valueOrGetter;
    return runtime.registerCondition(trigger.id, name as string, getter);
  };

  const mockAction = <S extends TriggerSchema, K extends ActionKey<S>>(
    trigger: Trigger<S>,
    name: K,
    handler: ActionFn<ActionMap<S>[K]>,
  ): RegistrationToken => {
    return runtime.registerAction(
      trigger.id,
      name as string,
      handler as unknown as UntypedActionFn,
    );
  };

  const flushMicrotasks = async (): Promise<void> => {
    // Two rounds: the first drains the queue we know about, the second picks
    // up follow-up microtasks queued by handlers that already ran.
    await Promise.resolve();
    await Promise.resolve();
  };

  return {
    ...runtime,
    mockCondition,
    mockAction,
    flushMicrotasks,
  };
}
