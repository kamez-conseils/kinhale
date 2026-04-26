import { Buffer } from 'buffer';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { YStack, Text, Button, Input } from 'tamagui';
import { fromHex, sealedBoxDecrypt, toHex } from '@kinhale/crypto';
import {
  acceptInvitation,
  fetchSealedGroupKey,
  getInvitationPublic,
  type InvitationPublicInfo,
} from '../../../src/lib/invitations/client';
import { useAuthStore } from '../../../src/stores/auth-store';
import { getDeviceX25519Keypair, setGroupKey } from '../../../src/lib/device';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 60_000;

export default function AcceptInvitationScreen(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string; pin?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const initialPin = typeof params.pin === 'string' ? params.pin : '';
  const [info, setInfo] = React.useState<InvitationPublicInfo | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState(initialPin);
  const [consent, setConsent] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
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

  React.useEffect(() => {
    if (phase !== 'awaiting-seal') return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const sealed = await fetchSealedGroupKey(token);
        if (sealed === null) {
          if (Date.now() - startedAt < POLL_TIMEOUT_MS && !cancelled) {
            setTimeout(() => void poll(), POLL_INTERVAL_MS);
          } else if (!cancelled) {
            setSubmitError(t('invitation.errorSealTimeout'));
          }
          return;
        }
        const keypair = await getDeviceX25519Keypair();
        const ciphertext = fromHex(sealed.sealedGroupKeyHex);
        const decrypted = await sealedBoxDecrypt(ciphertext, keypair);
        if (decrypted === null || decrypted.length !== 32) {
          setSubmitError(t('invitation.errorSealDecrypt'));
          return;
        }
        await setGroupKey(householdIdState, decrypted);
        if (!cancelled) router.replace('/journal');
      } catch {
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
        <Text>{t('invitation.awaitingSealBody')}</Text>
        {submitError !== null ? <Text color="$red10">{submitError}</Text> : null}
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
        {t('invitation.acceptTitle')}
      </Text>
      <Text>{info.displayName}</Text>
      <Text>{t('invitation.acceptInstruction')}</Text>

      <Input
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        placeholder={t('invitation.pinLabel')}
        accessibilityLabel={t('invitation.pinLabel')}
        keyboardType="numeric"
        maxLength={6}
      />

      <Button
        onPress={() => setConsent(!consent)}
        theme={consent ? 'active' : null}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        accessibilityLabel={t('invitation.consentLabel')}
      >
        {consent ? '✓ ' : '☐ '}
        {t('invitation.consentLabel')}
      </Button>

      <Button
        onPress={() => void handleSubmit()}
        disabled={pin.length !== 6 || !consent}
        theme="active"
        accessibilityRole="button"
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
 * de vérification cryptographique ; le device vient de recevoir le JWT du
 * backend authentifié par TLS. Utilisé pour récupérer householdId.
 */
function parseJwtClaims(token: string): { householdId?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[1] === undefined) return {};
    const json =
      typeof atob === 'function'
        ? atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json) as { householdId?: string };
    return payload;
  } catch {
    return {};
  }
}
