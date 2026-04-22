import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { YStack, Text, Button, Input } from 'tamagui';
import {
  acceptInvitation,
  getInvitationPublic,
  type InvitationPublicInfo,
} from '../../../src/lib/invitations/client';
import { useAuthStore } from '../../../src/stores/auth-store';

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
      useAuthStore.getState().setAuth(result.sessionToken, '', '');
      router.replace('/journal');
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
