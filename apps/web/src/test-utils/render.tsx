import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { TamaguiProvider } from 'tamagui';
import { I18nextProvider } from 'react-i18next';
import config from '../lib/tamagui.config';
import i18n from '../lib/i18n';

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {ui}
      </TamaguiProvider>
    </I18nextProvider>,
  );
}
