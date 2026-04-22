import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { YStack, Text, Button, Input } from 'tamagui';
import QRCode from 'react-native-qrcode-svg';
import { createInvitation, type CreatedInvitation } from '../../src/lib/invitations/client';

type TargetRole = 'contributor' | 'restricted_contributor';

export default function InviteCaregiverScreen(): React.JSX.Element {
  const { t } = useTranslation('common');
  const [role, setRole] = React.useState<TargetRole>('restricted_contributor');
  const [displayName, setDisplayName] = React.useState('');
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [remainingMs, setRemainingMs] = React.useState<number>(0);

  React.useEffect(() => {
    if (created === null) return undefined;
    const tick = (): void => setRemainingMs(Math.max(0, created.expiresAtMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [created]);

  const qrPayload = created !== null ? `kinhale://accept/${created.token}?pin=${created.pin}` : '';

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

  const handleCopy = async (): Promise<void> => {
    if (created === null) return;
    await Clipboard.setStringAsync(`kinhale://accept/${created.token}`);
  };

  if (created !== null) {
    const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
    return (
      <YStack padding="$4" gap="$3">
        <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
          {t('invitation.qrTitle')}
        </Text>
        <Text>{t('invitation.qrInstruction')}</Text>
        <YStack alignItems="center" padding="$3">
          <QRCode value={qrPayload} size={240} />
        </YStack>
        <Text fontSize="$5">
          {t('invitation.pinLabel')}:{' '}
          <Text fontWeight="bold" testID="pin-value">
            {created.pin}
          </Text>
        </Text>
        <Text>{t('invitation.expiresIn', { minutes })}</Text>
        <Button
          onPress={() => void handleCopy()}
          accessibilityRole="button"
          accessibilityLabel={t('invitation.copyLink')}
        >
          {t('invitation.copyLink')}
        </Button>
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
        {t('invitation.createTitle')}
      </Text>

      <YStack gap="$2">
        <Text>{t('invitation.roleLabel')}</Text>
        <Button
          onPress={() => setRole('contributor')}
          theme={role === 'contributor' ? 'active' : null}
          accessibilityRole="button"
          accessibilityLabel={t('invitation.roleContributor')}
        >
          {t('invitation.roleContributor')}
        </Button>
        <Button
          onPress={() => setRole('restricted_contributor')}
          theme={role === 'restricted_contributor' ? 'active' : null}
          accessibilityRole="button"
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
        accessibilityRole="button"
        accessibilityLabel={t('invitation.generateCta')}
      >
        {t('invitation.generateCta')}
      </Button>

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
