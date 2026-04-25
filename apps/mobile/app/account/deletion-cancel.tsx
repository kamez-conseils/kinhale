/**
 * Page mobile d'annulation de suppression (KIN-086, E9-S04).
 * Deep-link `kinhale://account/deletion-cancel`.
 */

import React, { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, Card } from 'tamagui';
import { ApiError } from '../../src/lib/api-client';
import { postDeletionCancel } from '../../src/lib/account-deletion/client';
import { useAuthStore } from '../../src/stores/auth-store';

type UiState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; messageKey: string };

export default function DeletionCancelScreen(): JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [state, setState] = useState<UiState>({ kind: 'idle' });

  useEffect(() => {
    if (accessToken === null) {
      router.replace('/auth');
    }
  }, [accessToken, router]);

  if (accessToken === null) return null;

  const handleCancel = async (): Promise<void> => {
    setState({ kind: 'submitting' });
    try {
      await postDeletionCancel();
      setState({ kind: 'success' });
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'unknown';
      const messageKey =
        code === 'grace_period_expired'
          ? 'accountDeletion.cancelPage.errorExpired'
          : code === 'not_pending'
            ? 'accountDeletion.cancelPage.errorNotPending'
            : 'accountDeletion.cancelPage.errorGeneric';
      setState({ kind: 'error', messageKey });
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1 accessibilityRole="header">{t('accountDeletion.cancelPage.title')}</H1>
      <Card padded bordered>
        <YStack gap="$3">
          {state.kind === 'success' ? (
            <YStack gap="$2">
              <Text fontWeight="bold" color="$green10">
                {t('accountDeletion.cancelPage.successTitle')}
              </Text>
              <Text>{t('accountDeletion.cancelPage.successMessage')}</Text>
            </YStack>
          ) : state.kind === 'error' ? (
            <Text color="$red10" accessibilityLiveRegion="polite">
              {t(state.messageKey)}
            </Text>
          ) : (
            <YStack gap="$3">
              <Text>{t('accountDeletion.cancelPage.description')}</Text>
              <Button
                onPress={() => {
                  void handleCancel();
                }}
                disabled={state.kind === 'submitting'}
                accessibilityLabel={t('accountDeletion.cancelPage.submitCta')}
                accessibilityRole="button"
              >
                {state.kind === 'submitting'
                  ? t('accountDeletion.cancelPage.submitting')
                  : t('accountDeletion.cancelPage.submitCta')}
              </Button>
            </YStack>
          )}
        </YStack>
      </Card>
    </YStack>
  );
}
