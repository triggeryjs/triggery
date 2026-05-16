import type { Runtime } from '@triggery/core';
import { createContext, useContext } from 'solid-js';

/**
 * Runtime context. Always carries a Runtime — consumers throw a helpful error
 * if they were rendered outside `<TriggerRuntimeProvider>`.
 */
export const RuntimeContext = createContext<Runtime | undefined>(undefined);

/**
 * Scope context. Default `''` means "global scope" (matches `@triggery/react`).
 */
export const ScopeContext = createContext<string>('');

export function useRuntime(): Runtime {
  const rt = useContext(RuntimeContext);
  if (!rt) {
    throw new Error(
      '[triggery/solid] No runtime — wrap your tree in <TriggerRuntimeProvider runtime={runtime}>.',
    );
  }
  return rt;
}

export function useScope(): string {
  return useContext(ScopeContext);
}
