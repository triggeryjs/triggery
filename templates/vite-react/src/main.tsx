import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './triggers/welcome.trigger.ts';

const runtime = createRuntime();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <TriggerRuntimeProvider runtime={runtime}>
      <App />
    </TriggerRuntimeProvider>
  </StrictMode>,
);
