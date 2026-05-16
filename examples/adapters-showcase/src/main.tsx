import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const runtime = createRuntime();
const queryClient = new QueryClient();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <TriggerRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </TriggerRuntimeProvider>
  </StrictMode>,
);
