'use client';

import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { type ReactNode, useState } from 'react';

/**
 * The runtime lives in client memory — pages stay server-renderable, but
 * any subtree under <TriggeryProviders> can use the Triggery hooks.
 *
 * Server Components stay no-op for Triggery in this template; full server
 * triggers ship in V2 as @triggery/server.
 */
export function TriggeryProviders({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => createRuntime());
  return <TriggerRuntimeProvider runtime={runtime}>{children}</TriggerRuntimeProvider>;
}
