import { type ReactNode, type JSX } from 'react';
import { TamaguiProvider } from 'tamagui';
import { I18nextProvider } from 'react-i18next';
import config from '../lib/tamagui.config';
import i18n from '../lib/i18n';
import { RelaySyncBootstrap } from '../lib/sync/RelaySyncBootstrap';

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {/* Monte la sync WS E2EE bidirectionnelle en arrière-plan */}
        <RelaySyncBootstrap />
        {children}
      </TamaguiProvider>
    </I18nextProvider>
  );
}
