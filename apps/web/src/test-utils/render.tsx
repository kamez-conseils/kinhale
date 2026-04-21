import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { TamaguiProvider } from 'tamagui';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import config from '../lib/tamagui.config';
import i18n from '../lib/i18n';

export function renderWithProviders(ui: ReactElement): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TamaguiProvider config={config} defaultTheme="light">
          {ui}
        </TamaguiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}
