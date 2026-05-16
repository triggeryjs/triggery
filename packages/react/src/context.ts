import { getDefaultRuntime, type Runtime } from '@triggery/core';
import { createContext, useContext } from 'react';

/**
 * React context used to inject a custom runtime. When no provider is present,
 * hooks fall back to the global default runtime.
 */
export const TriggerRuntimeContext = createContext<Runtime | undefined>(undefined);

/** Read the active runtime from context, or return the default runtime. */
export function useRuntime(): Runtime {
  const ctxRuntime = useContext(TriggerRuntimeContext);
  return ctxRuntime ?? getDefaultRuntime();
}

/**
 * Scope context — string id provided by `<TriggerScope id="…">`. Default is
 * `''` (global). Hooks pass it through to `registerCondition`/`registerAction`
 * so the runtime can match the registration against a trigger's `scope`.
 */
export const TriggerScopeContext = createContext<string>('');

/** Read the active scope from context. `''` means "global / no scope". */
export function useScope(): string {
  return useContext(TriggerScopeContext);
}
