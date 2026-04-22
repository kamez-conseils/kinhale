import React, { type ReactElement } from 'react';
import { render, type RenderAPI } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { TamaguiProvider } from 'tamagui';
import i18n from '../lib/i18n';
import config from '../lib/tamagui.config';

export function renderWithProviders(ui: ReactElement): RenderAPI {
  return render(
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {ui}
      </TamaguiProvider>
    </I18nextProvider>,
  );
}
