'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import { YStack, Text, Button, Input } from 'tamagui';
import { fromHex, sealedBoxDecrypt, toHex } from '@kinhale/crypto';
import {
  acceptInvitation,
  fetchSealedGroupKey,
  getInvitationPublic,
  type InvitationPublicInfo,
} from '../../../lib/invitations/client';
import { useAuthStore } from '../../../stores/auth-store';
import { getDeviceX25519Keypair, setGroupKey } from '../../../lib/device';

/**
 * Polling pour récupérer l'envelope X25519 (KIN-096).
 * Toutes les 5 s pendant 60 s. Au-delà, l'utilisateur peut retenter.
 */
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 60_000;

export default function AcceptInvitationPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [info, setInfo] = React.useState<InvitationPublicInfo | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  /** 'idle' | 'awaiting-seal' (acceptation OK, on attend l'admin) */
  const [phase, setPhase] = React.useState<'idle' | 'awaiting-seal'>('idle');
  const [householdIdState, setHouseholdIdState] = React.useState<string>('');

  React.useEffect(() => {
    if (token === '') return;
    getInvitationPublic(token)
      .then(setInfo)
      .catch((e: Error) => {
        const code = e.message;
        setLookupError(
          code === 'locked' ? t('invitation.errorLocked') : t('invitation.errorExpired'),
        );
      });
  }, [token, t]);

  // Polling de l'envelope X25519 après acceptation. Stoppe au décryptage
  // OU après POLL_TIMEOUT_MS. Aucun log du contenu (kz-securite §logging).
  React.useEffect(() => {
    if (phase !== 'awaiting-seal') return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const sealed = await fetchSealedGroupKey(token);
        if (sealed === null) {
          // Pas encore scellé — réessaie sauf si timeout dépassé
          if (Date.now() - startedAt < POLL_TIMEOUT_MS && !cancelled) {
            setTimeout(() => void poll(), POLL_INTERVAL_MS);
          } else if (!cancelled) {
            setSubmitError(t('invitation.errorSealTimeout'));
          }
          return;
        }
        // Déchiffre via X25519 device privée
        const keypair = await getDeviceX25519Keypair();
        const ciphertext = fromHex(sealed.sealedGroupKeyHex);
        const decrypted = await sealedBoxDecrypt(ciphertext, keypair);
        if (decrypted === null) {
          // Échec crypto — ne révèle aucun détail à l'utilisateur (anti-oracle)
          setSubmitError(t('invitation.errorSealDecrypt'));
          return;
        }
        if (decrypted.length !== 32) {
          setSubmitError(t('invitation.errorSealDecrypt'));
          return;
        }
        await setGroupKey(householdIdState, decrypted);
        if (!cancelled) router.push('/journal');
      } catch {
        // Anti-fuite : on ne propage pas le détail réseau dans l'UI
        if (Date.now() - startedAt < POLL_TIMEOUT_MS && !cancelled) {
          setTimeout(() => void poll(), POLL_INTERVAL_MS);
        } else if (!cancelled) {
          setSubmitError(t('invitation.errorSealTimeout'));
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [phase, token, t, router, householdIdState]);

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null);
    if (!consent) {
      setSubmitError(t('invitation.errorConsent'));
      return;
    }
    try {
      const keypair = await getDeviceX25519Keypair();
      const recipientPublicKeyHex = toHex(keypair.publicKey);
      const result = await acceptInvitation(token, pin, true, recipientPublicKeyHex);
      // KIN-096 — le sessionToken contient le householdId. On extrait pour
      // pouvoir setGroupKey() après poll. Décodage JWT côté client (pas de
      // vérification de signature — c'est le navigateur qui vient juste de
      // recevoir le token de la part du backend authentifié par TLS).
      const claims = parseJwtClaims(result.sessionToken);
      const householdId = claims.householdId ?? '';
      useAuthStore.getState().setAuth(result.sessionToken, '', householdId);
      setHouseholdIdState(householdId);
      setPhase('awaiting-seal');
    } catch (e) {
      const code = (e as Error).message;
      const map: Record<string, string> = {
        pin_mismatch: 'invitation.errorPinMismatch',
        locked: 'invitation.errorLocked',
        consent_required: 'invitation.errorConsent',
        not_found_or_expired: 'invitation.errorExpired',
      };
      setSubmitError(t(map[code] ?? 'invitation.errorExpired'));
    }
  };

  if (lookupError !== null) {
    return (
      <YStack padding="$4" gap="$3">
        <Text color="$red10">{lookupError}</Text>
        <Button
          onPress={() => router.push('/auth')}
          backgroundColor="$blue9"
          color="white"
          borderColor="$blue10"
          borderWidth={2}
          accessibilityRole="button"
          accessibilityLabel={t('invitation.backToAuth')}
        >
          {t('invitation.backToAuth')}
        </Button>
      </YStack>
    );
  }

  if (info === null) {
    return (
      <YStack padding="$4">
        <Text>…</Text>
      </YStack>
    );
  }

  if (phase === 'awaiting-seal') {
    return (
      <YStack padding="$4" gap="$3">
        <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
          {t('invitation.awaitingSealTitle')}
        </Text>
        <Text role="status">{t('invitation.awaitingSealBody')}</Text>
        {submitError !== null ? <Text color="$red10">{submitError}</Text> : null}
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold">
        {t('invitation.acceptTitle')}
      </Text>
      <Text>{info.displayName}</Text>
      <Text>{t('invitation.acceptInstruction')}</Text>

      <Input
        value={pin}
        onChangeText={(v: string) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        placeholder={t('invitation.pinLabel')}
        accessibilityLabel={t('invitation.pinLabel')}
        keyboardType="numeric"
        maxLength={6}
      />

      <Button
        onPress={() => setConsent((c) => !c)}
        backgroundColor={consent ? '$blue9' : '$backgroundStrong'}
        color={consent ? 'white' : '$color'}
        borderColor={consent ? '$blue10' : '$borderColor'}
        borderWidth={2}
        accessibilityLabel={t('invitation.consentLabel')}
        testID="consent-toggle"
      >
        {consent ? '✓ ' : ''}
        {t('invitation.consentLabel')}
      </Button>

      <Button
        onPress={() => void handleSubmit()}
        disabled={pin.length !== 6 || !consent}
        backgroundColor="$blue9"
        color="white"
        borderColor="$blue10"
        borderWidth={2}
        accessibilityLabel={t('invitation.acceptCta')}
      >
        {t('invitation.acceptCta')}
      </Button>

      {submitError !== null ? <Text color="$red10">{submitError}</Text> : null}
    </YStack>
  );
}

/**
 * Parse minimal JWT claims (header.payload.signature) — payload only. Pas
 * de vérification cryptographique : on fait simplement confiance au backend
 * qui vient de répondre via TLS. Utilisé pour récupérer householdId.
 */
function parseJwtClaims(token: string): { householdId?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[1] === undefined) return {};
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { householdId?: string };
    return payload;
  } catch {
    return {};
  }
}
