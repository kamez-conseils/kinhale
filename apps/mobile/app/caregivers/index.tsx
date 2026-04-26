import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Button, Card } from 'tamagui';
import { projectCaregivers } from '@kinhale/sync';
import { fromHex, sealedBoxEncrypt, toHex } from '@kinhale/crypto';
import { useDocStore } from '../../src/stores/doc-store';
import { useAuthStore } from '../../src/stores/auth-store';
import {
  listInvitations,
  revokeInvitation,
  sealInvitation,
  type InvitationSummary,
} from '../../src/lib/invitations/client';
import { getGroupKey } from '../../src/lib/device';

export default function CaregiversIndexScreen(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const doc = useDocStore((s) => s.doc);
  const householdId = useAuthStore((s) => s.householdId);
  const caregivers = doc !== null ? projectCaregivers(doc) : [];
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [sealingToken, setSealingToken] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setInvitations(await listInvitations());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRevoke = async (token: string): Promise<void> => {
    try {
      await revokeInvitation(token);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSeal = async (inv: InvitationSummary): Promise<void> => {
    if (sealingToken !== null) return;
    if (typeof householdId !== 'string' || householdId.length === 0) {
      setError(t('invitation.errorSealMissingGroupKey'));
      return;
    }
    setSealingToken(inv.token);
    setError(null);
    try {
      if (
        inv.hasRecipientPublicKey !== true ||
        typeof inv.recipientPublicKeyHex !== 'string' ||
        inv.recipientPublicKeyHex.length !== 64
      ) {
        setError(t('invitation.errorSealNoPubkey'));
        return;
      }
      const groupKey = await getGroupKey(householdId);
      const recipientPublicKey = fromHex(inv.recipientPublicKeyHex);
      const sealed = await sealedBoxEncrypt(groupKey, recipientPublicKey);
      await sealInvitation(inv.token, toHex(sealed));
      await refresh();
    } catch {
      setError(t('invitation.errorSealFailed'));
    } finally {
      setSealingToken(null);
    }
  };

  const pendingSealing = invitations.filter(
    (inv) => inv.hasRecipientPublicKey === true && inv.hasSealedGroupKey !== true,
  );
  const pendingAcceptance = invitations.filter((inv) => inv.hasRecipientPublicKey !== true);
  const sealedAndWaiting = invitations.filter(
    (inv) => inv.hasRecipientPublicKey === true && inv.hasSealedGroupKey === true,
  );

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
        {t('invitation.listTitle')}
      </Text>

      {caregivers.length === 0 && invitations.length === 0 ? (
        <Text>{t('invitation.listEmpty')}</Text>
      ) : null}

      {caregivers.map((c) => (
        <Card key={c.caregiverId} padding="$3">
          <Text fontWeight="bold">{c.displayName}</Text>
          <Text>
            {c.role === 'contributor'
              ? t('invitation.roleContributor')
              : t('invitation.roleRestricted')}
          </Text>
        </Card>
      ))}

      {pendingSealing.length > 0 ? (
        <YStack gap="$2">
          <Text fontSize="$5" fontWeight="bold" accessibilityRole="header">
            {t('invitation.pendingSealTitle')}
          </Text>
          <Text>{t('invitation.pendingSealHint')}</Text>
          {pendingSealing.map((inv) => (
            <Card key={inv.token} padding="$3">
              <XStack justifyContent="space-between" alignItems="center" gap="$2">
                <YStack flex={1}>
                  <Text fontWeight="bold">{inv.displayName}</Text>
                  <Text>
                    {inv.targetRole === 'contributor'
                      ? t('invitation.roleContributor')
                      : t('invitation.roleRestricted')}
                  </Text>
                </YStack>
                <Button
                  onPress={() => void handleSeal(inv)}
                  disabled={sealingToken !== null}
                  theme="active"
                  accessibilityRole="button"
                  accessibilityLabel={t('invitation.sealCta')}
                >
                  {sealingToken === inv.token
                    ? t('invitation.sealInProgress')
                    : t('invitation.sealCta')}
                </Button>
              </XStack>
            </Card>
          ))}
        </YStack>
      ) : null}

      {pendingAcceptance.map((inv) => (
        <Card key={inv.token} padding="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack flex={1}>
              <Text fontWeight="bold">{inv.displayName}</Text>
              <Text>
                {inv.targetRole === 'contributor'
                  ? t('invitation.roleContributor')
                  : t('invitation.roleRestricted')}
              </Text>
            </YStack>
            <Button
              onPress={() => void handleRevoke(inv.token)}
              accessibilityRole="button"
              accessibilityLabel={t('invitation.revokeCta')}
            >
              {t('invitation.revokeCta')}
            </Button>
          </XStack>
        </Card>
      ))}

      {sealedAndWaiting.map((inv) => (
        <Card key={inv.token} padding="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack flex={1}>
              <Text fontWeight="bold">{inv.displayName}</Text>
              <Text color="$gray10">{t('invitation.sealedAndWaiting')}</Text>
            </YStack>
            <Button
              onPress={() => void handleRevoke(inv.token)}
              accessibilityRole="button"
              accessibilityLabel={t('invitation.revokeCta')}
            >
              {t('invitation.revokeCta')}
            </Button>
          </XStack>
        </Card>
      ))}

      <Button
        onPress={() => router.push('/caregivers/invite')}
        theme="active"
        accessibilityRole="button"
        accessibilityLabel={t('invitation.createCta')}
      >
        {t('invitation.createCta')}
      </Button>

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
