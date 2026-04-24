import React, { type JSX } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import { TamaguiProvider } from 'tamagui';
import i18n from '../src/lib/i18n';
import config from '../src/lib/tamagui.config';
import { usePushRegistration } from '../src/hooks/use-push-registration';
import { SyncStatusBadge } from '../src/components/SyncStatusBadge';
import { RelaySyncBootstrap, RemindersBootstrap } from '../src/lib/sync';

export default function RootLayout(): JSX.Element {
  usePushRegistration();

  return (
    <I18nextProvider i18n={i18n}>
      <TamaguiProvider config={config} defaultTheme="light">
        {/* Sync WS E2EE bidirectionnelle + rattrapage delta (KIN-38/70). Leur
            absence ici faisait que le store `sync-status` restait figé offline
            côté mobile — révélé par la revue de KIN-75. */}
        <RelaySyncBootstrap />
        {/* Scheduler rappels + watcher doses manquées (KIN-38). */}
        <RemindersBootstrap />
        {/* Badge statut de sync affiché au-dessus du stack de navigation. E7-S05 */}
        <SyncStatusBadge />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </TamaguiProvider>
    </I18nextProvider>
  );
}
