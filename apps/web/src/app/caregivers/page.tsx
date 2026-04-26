'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { YStack, XStack, Text, Button, Card } from 'tamagui';
import { projectCaregivers } from '@kinhale/sync';
import { useDocStore } from '../../stores/doc-store';
import { useAuthStore } from '../../stores/auth-store';
import {
  listInvitations,
  revokeInvitation,
  type InvitationSummary,
} from '../../lib/invitations/client';
import { useRequireAuth } from '../../lib/useRequireAuth';

export default function CaregiversPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const doc = useDocStore((s) => s.doc);
  const caregivers = doc !== null ? projectCaregivers(doc) : [];
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      setInvitations(await listInvitations());
      setError(null);
    } catch {
      setError(t('invitation.errorLoadList'));
    }
  }, [accessToken, t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRevoke = async (token: string): Promise<void> => {
    try {
      await revokeInvitation(token);
      await refresh();
    } catch {
      setError(t('invitation.errorLoadList'));
    }
  };

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold">
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

      {invitations.map((inv) => (
        <Card key={inv.token} padding="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontWeight="bold">{inv.displayName}</Text>
              <Text>
                {inv.targetRole === 'contributor'
                  ? t('invitation.roleContributor')
                  : t('invitation.roleRestricted')}
              </Text>
            </YStack>
            <Button
              onPress={() => void handleRevoke(inv.token)}
              accessibilityLabel={t('invitation.revokeCta')}
            >
              {t('invitation.revokeCta')}
            </Button>
          </XStack>
        </Card>
      ))}

      <Button
        onPress={() => router.push('/caregivers/invite')}
        backgroundColor="$blue9"
        color="white"
        borderColor="$blue10"
        borderWidth={2}
        accessibilityLabel={t('invitation.createCta')}
      >
        {t('invitation.createCta')}
      </Button>

      <Button
        onPress={() => router.push('/caregivers/scan')}
        backgroundColor="$backgroundStrong"
        color="$color"
        borderColor="$borderColor"
        borderWidth={2}
        accessibilityLabel={t('invitation.scanCta')}
      >
        {t('invitation.scanCta')}
      </Button>

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
