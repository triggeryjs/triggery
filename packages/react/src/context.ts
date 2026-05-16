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
