import React, { type JSX } from 'react';
import { Stack } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import { TamaguiProvider } from 'tamagui';
import i18n from '../src/lib/i18n';
import config from '../src/lib/tamagui.config';
import { usePushRegistration } from '../src/hooks/use-push-registration';

export default function RootLayout(): JSX.Element {
  usePushRegistration();

  return (
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        <Stack screenOptions={{ headerShown: false }} />
      </TamaguiProvider>
    </I18nextProvider>
  );
}
