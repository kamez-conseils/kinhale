'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { YStack, XStack, Text, Button, Card } from 'tamagui';
import { projectCaregivers } from '@kinhale/sync';
import { useDocStore } from '../../stores/doc-store';
import {
  listInvitations,
  revokeInvitation,
  type InvitationSummary,
} from '../../lib/invitations/client';

export default function CaregiversPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const doc = useDocStore((s) => s.doc);
  const caregivers = doc !== null ? projectCaregivers(doc) : [];
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

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
        theme="active"
        accessibilityLabel={t('invitation.createCta')}
      >
        {t('invitation.createCta')}
      </Button>

      {error !== null ? <Text color="$red10">{error}</Text> : null}
    </YStack>
  );
}
