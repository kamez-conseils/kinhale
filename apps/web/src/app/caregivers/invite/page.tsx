'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { YStack, XStack, Text, Button, Input } from 'tamagui';
import { createInvitation, type CreatedInvitation } from '../../../lib/invitations/client';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';

type TargetRole = 'contributor' | 'restricted_contributor';

export default function InviteCaregiverPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const [role, setRole] = React.useState<TargetRole>('restricted_contributor');
  const [displayName, setDisplayName] = React.useState('');
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [remainingMs, setRemainingMs] = React.useState<number>(0);

  React.useEffect(() => {
    if (created === null) return undefined;
    const payload = `${window.location.origin}/accept-invitation/${created.token}?pin=${created.pin}`;
    void QRCode.toDataURL(payload).then((url) => setQrDataUrl(url));
    const tick = (): void => setRemainingMs(Math.max(0, created.expiresAtMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [created]);

  const handleSubmit = async (): Promise<void> => {
    // Défense en profondeur : même si le bouton est `disabled` quand !online,
    // un utilisateur qui réactiverait le DOM via DevTools ne doit pas réussir
    // à déclencher un appel réseau voué à l'échec. Refs: kz-securite-075-078 §m1.
    if (!online) return;
    setError(null);
    try {
      const result = await createInvitation({ targetRole: role, displayName });
      setCreated(result);
    } catch (e) {
      const code = (e as Error).message;
      const key =
        code === 'invitation_quota_exceeded' ? 'invitation.errorQuota' : 'invitation.errorExpired';
      setError(t(key));
    }
  };

  const handleCopy = (): void => {
    if (created === null) return;
    void navigator.clipboard.writeText(
      `${window.location.origin}/accept-invitation/${created.token}`,
    );
  };

  if (!authenticated) return null;

  if (created !== null) {
    const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
    return (
      <YStack padding="$4" gap="$3">
        <Text fontSize="$6" fontWeight="bold">
          {t('invitation.qrTitle')}
        </Text>
        <Text>{t('invitation.qrInstruction')}</Text>
        {qrDataUrl !== null ? <img src={qrDataUrl} alt="QR" width={240} height={240} /> : null}
        <Text fontSize="$5">
          {t('invitation.pinLabel')}:{' '}
          <Text fontWeight="bold" testID="pin-value">
            {created.pin}
          </Text>
        </Text>
        <Text>{t('invitation.expiresIn', { minutes })}</Text>
        <Button onPress={handleCopy} accessibilityLabel={t('invitation.copyLink')}>
          {t('invitation.copyLink')}
        </Button>
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold">
        {t('invitation.createTitle')}
      </Text>

      <YStack gap="$2">
        <Text>{t('invitation.roleLabel')}</Text>
        <XStack gap="$2">
          <Button
            onPress={() => setRole('contributor')}
            backgroundColor={role === 'contributor' ? '$blue9' : '$backgroundStrong'}
            color={role === 'contributor' ? 'white' : '$color'}
            borderWidth={2}
            borderColor={role === 'contributor' ? '$blue10' : '$borderColor'}
            flex={1}
            accessibilityRole="radio"
            accessibilityState={{ checked: role === 'contributor' }}
            accessibilityLabel={t('invitation.roleContributor')}
          >
            {t('invitation.roleContributor')}
          </Button>
          <Button
            onPress={() => setRole('restricted_contributor')}
            backgroundColor={role === 'restricted_contributor' ? '$blue9' : '$backgroundStrong'}
            color={role === 'restricted_contributor' ? 'white' : '$color'}
            borderWidth={2}
            borderColor={role === 'restricted_contributor' ? '$blue10' : '$borderColor'}
            flex={1}
            accessibilityRole="radio"
            accessibilityState={{ checked: role === 'restricted_contributor' }}
            accessibilityLabel={t('invitation.roleRestricted')}
          >
            {t('invitation.roleRestricted')}
          </Button>
        </XStack>
      </YStack>

      <YStack gap="$2">
        <Text>{t('invitation.displayNameLabel')}</Text>
        <Input
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('invitation.displayNamePlaceholder')}
          accessibilityLabel={t('invitation.displayNameLabel')}
        />
      </YStack>

      <Button
        onPress={() => void handleSubmit()}
        disabled={displayName.trim().length === 0 || !online}
        backgroundColor="$blue9"
        color="white"
        borderColor="$blue10"
        borderWidth={2}
        accessibilityLabel={t('invitation.generateCta')}
      >
        {t('invitation.generateCta')}
      </Button>

      {!online ? (
        <Text color="$orange10" testID="offline-guard-message" role="status">
          {t('offlineGuard.message')}
        </Text>
      ) : null}

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
