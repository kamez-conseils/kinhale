'use client';

/**
 * Page d'annulation de suppression depuis l'e-mail T0 (KIN-086, E9-S04).
 *
 * URL : `/account/deletion-cancel?token=...` (token optionnel — v1.0
 * utilise simplement le JWT existant, mais on garde la query string pour
 * compat avec les e-mails T0 qui en envoient un dans une future itération).
 *
 * En v1.0, le bouton « Annuler » :
 * 1. Vérifie que l'utilisateur a une session active (JWT) — sinon redirige
 *    vers `/auth`.
 * 2. POST /me/account/deletion-cancel avec le Bearer token.
 * 3. Affiche le succès / l'erreur.
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, Card } from 'tamagui';
import { ApiError } from '../../../lib/api-client';
import { postDeletionCancel } from '../../../lib/account-deletion/client';
import { useAuthStore } from '../../../stores/auth-store';

type UiState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; messageKey: string };

function CancelInner(): React.JSX.Element | null {
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
    <YStack padding="$4" gap="$4" maxWidth={600} marginHorizontal="auto" width="100%">
      <H1>{t('accountDeletion.cancelPage.title')}</H1>
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

export default function DeletionCancelPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <CancelInner />
    </Suspense>
  );
}
