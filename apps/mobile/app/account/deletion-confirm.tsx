/**
 * Page mobile de confirmation de suppression (KIN-086, E9-S03).
 * Reçoit le token via deep-link `kinhale://account/deletion-confirm?token=...`.
 */

import React, { useState, type JSX } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, Card } from 'tamagui';
import { ApiError } from '../../src/lib/api-client';
import { postDeletionConfirm } from '../../src/lib/account-deletion/client';

type UiState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; scheduledAtMs: number }
  | { kind: 'error'; messageKey: string };

export default function DeletionConfirmScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [state, setState] = useState<UiState>({ kind: 'idle' });

  const handleConfirm = async (): Promise<void> => {
    if (!/^[0-9a-f]{64}$/.test(token)) {
      setState({ kind: 'error', messageKey: 'accountDeletion.confirmPage.errorInvalidToken' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const r = await postDeletionConfirm(token);
      setState({ kind: 'success', scheduledAtMs: r.scheduledAtMs });
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'unknown';
      const messageKey =
        code === 'invalid_or_expired_token'
          ? 'accountDeletion.confirmPage.errorInvalidToken'
          : code === 'token_already_used'
            ? 'accountDeletion.confirmPage.errorTokenUsed'
            : 'accountDeletion.confirmPage.errorGeneric';
      setState({ kind: 'error', messageKey });
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1 accessibilityRole="header">{t('accountDeletion.confirmPage.title')}</H1>
      <Card padded bordered>
        <YStack gap="$3">
          {state.kind === 'success' ? (
            <YStack gap="$2">
              <Text fontWeight="bold" color="$green10">
                {t('accountDeletion.confirmPage.successTitle')}
              </Text>
              <Text>
                {t('accountDeletion.confirmPage.successMessage', {
                  date: new Date(state.scheduledAtMs).toISOString().slice(0, 10),
                })}
              </Text>
            </YStack>
          ) : state.kind === 'error' ? (
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(state.messageKey)}
            </Text>
          ) : (
            <YStack gap="$3">
              <Text>{t('accountDeletion.confirmPage.description')}</Text>
              <Button
                onPress={() => {
                  void handleConfirm();
                }}
                disabled={state.kind === 'submitting' || token === ''}
                theme="red"
                accessibilityLabel={t('accountDeletion.confirmPage.submitCta')}
                accessibilityRole="button"
              >
                {state.kind === 'submitting'
                  ? t('accountDeletion.confirmPage.submitting')
                  : t('accountDeletion.confirmPage.submitCta')}
              </Button>
            </YStack>
          )}
        </YStack>
      </Card>
    </YStack>
  );
}
