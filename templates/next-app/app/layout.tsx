import type { ReactNode } from 'react';
import { TriggeryProviders } from './providers.tsx';

export const metadata = {
  title: 'Triggery starter — Next.js',
  description: 'Declarative business-logic orchestration with Triggery + Next.js App Router.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <TriggeryProviders>{children}</TriggeryProviders>
      </body>
    </html>
  );
}
