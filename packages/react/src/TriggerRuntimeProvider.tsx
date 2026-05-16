import type { Runtime } from '@triggery/core';
import type { ReactNode } from 'react';
import { TriggerRuntimeContext } from './context.ts';

export type TriggerRuntimeProviderProps = {
  readonly runtime: Runtime;
  readonly children: ReactNode;
};

/**
 * Provide a custom runtime to all descendants. Without a provider, hooks use the
 * global `defaultRuntime`.
 *
 * @example
 * ```tsx
 * const isolated = createRuntime();
 * <TriggerRuntimeProvider runtime={isolated}>
 *   <MyApp />
 * </TriggerRuntimeProvider>
 * ```
 */
export function TriggerRuntimeProvider({ runtime, children }: TriggerRuntimeProviderProps) {
  return (
    <TriggerRuntimeContext.Provider value={runtime}>{children}</TriggerRuntimeContext.Provider>
  );
}
