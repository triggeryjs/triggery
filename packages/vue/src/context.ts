import type { Runtime } from '@triggery/core';
import { type InjectionKey, inject, provide } from 'vue';

/**
 * Symbol-typed injection keys so multiple Triggery runtimes can coexist with
 * other Vue providers without name collisions.
 */
export const RUNTIME_KEY: InjectionKey<Runtime> = Symbol('@triggery/vue/runtime');
export const SCOPE_KEY: InjectionKey<string> = Symbol('@triggery/vue/scope');

/**
 * Provide a runtime to the current component subtree. Call this in setup()
 * of a root or layout component. Equivalent to `<TriggerRuntimeProvider>` —
 * use whichever fits your code style.
 */
export function provideTriggerRuntime(runtime: Runtime): void {
  provide(RUNTIME_KEY, runtime);
}

/**
 * Provide a scope id (analogue of `<TriggerScope id="…">`). Use either the
 * component wrapper or this function — both result in the same `inject` key
 * being available to descendants.
 */
export function provideTriggerScope(scopeId: string): void {
  provide(SCOPE_KEY, scopeId);
}

export function useRuntime(): Runtime {
  const rt = inject(RUNTIME_KEY);
  if (!rt) {
    throw new Error(
      '[triggery/vue] No runtime — call provideTriggerRuntime() in a parent setup() or wrap in <TriggerRuntimeProvider :runtime="…">.',
    );
  }
  return rt;
}

export function useScope(): string {
  return inject(SCOPE_KEY, '');
}
