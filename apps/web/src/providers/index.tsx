'use client';

import { useState, type JSX, type ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import config from '../lib/tamagui.config';
import i18n from '../lib/i18n';
import { RelaySyncBootstrap, RemindersBootstrap } from '../lib/sync';

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TamaguiProvider config={config} defaultTheme="light">
          {/* Monte la sync WS E2EE bidirectionnelle en arrière-plan */}
          <RelaySyncBootstrap />
          {/* Programme les rappels de dose + surveille les doses manquées */}
          <RemindersBootstrap />
          {children}
        </TamaguiProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
