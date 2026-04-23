'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import { YStack, Text, Button, Input } from 'tamagui';
import {
  acceptInvitation,
  getInvitationPublic,
  type InvitationPublicInfo,
} from '../../../lib/invitations/client';
import { useAuthStore } from '../../../stores/auth-store';

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

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null);
    if (!consent) {
      setSubmitError(t('invitation.errorConsent'));
      return;
    }
    try {
      const result = await acceptInvitation(token, pin, true);
      // setAuth requires token + deviceId + householdId; deviceId and householdId
      // are not returned by this endpoint — set to empty strings and let the
      // next sync cycle populate them from the E2EE handshake.
      useAuthStore.getState().setAuth(result.sessionToken, '', '');
      router.push('/journal');
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
