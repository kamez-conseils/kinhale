'use client';

import type { JSX, ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import config from '../lib/tamagui.config';
import i18n from '../lib/i18n';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TamaguiProvider config={config} defaultTheme="light">
          {children}
        </TamaguiProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
