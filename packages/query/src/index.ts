import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Minimal QueryClient shape we depend on. Matches `@tanstack/query-core`'s
 * `QueryClient.getQueryData(key)` signature without importing the package.
 */
export interface QueryClientLike {
  getQueryData<T>(queryKey: readonly unknown[]): T | undefined;
}

/**
 * Wire a TanStack Query cache entry into a Triggery condition.
 *
 * The runtime is pull-only — `queryClient.getQueryData(queryKey)` runs **only**
 * when a trigger fires, not on every cache update. The hook does not subscribe
 * the host component to the query; if a component also needs the data in JSX,
 * use TanStack Query's `useQuery` / `useQueryClient` alongside.
 *
 * The condition value is the latest cached data for the key. Missing entries
 * yield `undefined`, which fails the required-gate cleanly when a trigger
 * declares the condition as `required`.
 *
 * @example
 * ```tsx
 * import { QueryClient } from '@tanstack/query-core';
 * import { useQueryCondition } from '@triggery/query';
 *
 * const queryClient = new QueryClient();
 *
 * function CurrentUserBridge() {
 *   useQueryCondition(messageTrigger, 'user', queryClient, ['user', 'current']);
 *   return null;
 * }
 * ```
 *
 * @param selector  Optional projection of the cached data into the condition shape.
 */
export function useQueryCondition<T, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  queryClient: QueryClientLike,
  queryKey: readonly unknown[],
  selector?: (data: T | undefined) => ConditionMap<S>[K] | undefined,
): void {
  useCondition(
    trigger,
    name,
    () => {
      const data = queryClient.getQueryData<T>(queryKey);
      if (selector) return selector(data) as ConditionMap<S>[K];
      return data as unknown as ConditionMap<S>[K];
    },
    [queryClient, queryKey, selector],
  );
}
