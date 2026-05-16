import type { CheckCtx } from './types.ts';

/**
 * Builds the `check` helper bound to a specific conditions snapshot.
 *
 * `is`, `all` and `any` accept predicates over `NonNullable<C[K]>`: if a condition is
 * absent (`undefined` or `null`), the predicate is not invoked and the result is `false`
 * for that key.
 */
export function createCheck<C extends Record<string, unknown>>(conditions: C): CheckCtx<C> {
  return {
    is(key, predicate) {
      const value = conditions[key];
      if (value === undefined || value === null) return false;
      return predicate(value as NonNullable<C[typeof key]>);
    },
    all(map) {
      for (const key of Object.keys(map) as (keyof C)[]) {
        const predicate = (map as Record<keyof C, ((value: unknown) => boolean) | undefined>)[key];
        if (!predicate) continue;
        const value = conditions[key];
        if (value === undefined || value === null) return false;
        if (!predicate(value)) return false;
      }
      return true;
    },
    any(map) {
      for (const key of Object.keys(map) as (keyof C)[]) {
        const predicate = (map as Record<keyof C, ((value: unknown) => boolean) | undefined>)[key];
        if (!predicate) continue;
        const value = conditions[key];
        if (value === undefined || value === null) continue;
        if (predicate(value)) return true;
      }
      return false;
    },
  };
}
