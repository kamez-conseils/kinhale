'use client';

/**
 * Page de confirmation de suppression (KIN-086, E9-S03).
 *
 * URL : `/account/deletion-confirm?token=<step-up-token>`
 *
 * L'utilisateur arrive ici depuis le lien envoyé par e-mail. La page :
 * 1. Lit le token dans la query string.
 * 2. Affiche un récap + bouton de confirmation explicite (double opt-in
 *    pour éviter les pré-fetchs / scanners e-mail qui auto-cliqueraient).
 * 3. Au click : POST /me/account/deletion-confirm avec le token, sans JWT.
 * 4. Affiche le succès (date prévue de purge) + lien retour vers settings.
 */

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, Card } from 'tamagui';
import { ApiError } from '../../../lib/api-client';
import { postDeletionConfirm } from '../../../lib/account-deletion/client';

type UiState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; scheduledAtMs: number }
  | { kind: 'error'; messageKey: string };

function ConfirmInner(): React.JSX.Element {
  const { t } = useTranslation('common');
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<UiState>({ kind: 'idle' });

  const handleConfirm = async (): Promise<void> => {
    if (token === '' || !/^[0-9a-f]{64}$/.test(token)) {
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
    <YStack padding="$4" gap="$4" maxWidth={600} marginHorizontal="auto" width="100%">
      <H1>{t('accountDeletion.confirmPage.title')}</H1>
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

export default function DeletionConfirmPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
