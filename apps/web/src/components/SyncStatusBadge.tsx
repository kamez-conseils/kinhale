'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { XStack, Text } from 'tamagui';
import { useSyncStatusStore } from '../stores/sync-status-store';

/**
 * Badge de statut de synchronisation affiché en haut de l'app.
 *
 * États :
 * - `!connected` → badge rouge "Hors-ligne" (E7-S05 AC 1)
 * - `connected && pulling` → badge discret "Synchronisation…" (E7-S05 AC 2)
 * - `connected && !pulling` → aucun rendu (UI calme quand tout va bien)
 *
 * Refs: KIN-75 / E7-S05.
 */
export function SyncStatusBadge(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const connected = useSyncStatusStore((s) => s.connected);
  const pulling = useSyncStatusStore((s) => s.pulling);

  if (!connected) {
    return (
      <XStack
        backgroundColor="$red5"
        paddingHorizontal="$3"
        paddingVertical="$2"
        alignItems="center"
        gap="$2"
        testID="sync-status-badge-offline"
        role="status"
        aria-live="polite"
      >
        <Text color="$red11" fontWeight="bold">
          {t('sync.offline')}
        </Text>
      </XStack>
    );
  }

  if (pulling) {
    return (
      <XStack
        backgroundColor="$blue3"
        paddingHorizontal="$3"
        paddingVertical="$2"
        alignItems="center"
        gap="$2"
        testID="sync-status-badge-pulling"
        role="status"
        aria-live="polite"
      >
        <Text color="$blue11">{t('sync.syncing')}</Text>
      </XStack>
    );
  }

  return null;
}
