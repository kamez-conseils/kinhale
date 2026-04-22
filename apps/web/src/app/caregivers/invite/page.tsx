'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { YStack, Text, Button, Input } from 'tamagui';
import { createInvitation, type CreatedInvitation } from '../../../lib/invitations/client';

type TargetRole = 'contributor' | 'restricted_contributor';

export default function InviteCaregiverPage(): React.JSX.Element {
  const { t } = useTranslation('common');
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
        <Button
          onPress={() => setRole('contributor')}
          theme={role === 'contributor' ? 'active' : null}
          accessibilityLabel={t('invitation.roleContributor')}
        >
          {t('invitation.roleContributor')}
        </Button>
        <Button
          onPress={() => setRole('restricted_contributor')}
          theme={role === 'restricted_contributor' ? 'active' : null}
          accessibilityLabel={t('invitation.roleRestricted')}
        >
          {t('invitation.roleRestricted')}
        </Button>
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
        disabled={displayName.trim().length === 0}
        theme="active"
        accessibilityLabel={t('invitation.generateCta')}
      >
        {t('invitation.generateCta')}
      </Button>

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
