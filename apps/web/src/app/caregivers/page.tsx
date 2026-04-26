'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { YStack, XStack, Text, Button, Card } from 'tamagui';
import { projectCaregivers } from '@kinhale/sync';
import { fromHex, sealedBoxEncrypt, toHex } from '@kinhale/crypto';
import { useDocStore } from '../../stores/doc-store';
import { useAuthStore } from '../../stores/auth-store';
import {
  listInvitations,
  revokeInvitation,
  sealInvitation,
  type InvitationSummary,
} from '../../lib/invitations/client';
import { getGroupKey } from '../../lib/device';
import { useRequireAuth } from '../../lib/useRequireAuth';

export default function CaregiversPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const caregivers = doc !== null ? projectCaregivers(doc) : [];
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [sealingToken, setSealingToken] = React.useState<string | null>(null);

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

  const handleSeal = async (inv: InvitationSummary): Promise<void> => {
    if (sealingToken !== null) return;
    if (typeof householdId !== 'string' || householdId.length === 0) {
      setError(t('invitation.errorSealMissingGroupKey'));
      return;
    }
    setSealingToken(inv.token);
    setError(null);
    try {
      const groupKey = await getGroupKey(householdId);
      // KIN-096 — clé publique X25519 fournie par l'invité, lue côté backend
      // via /invitations endpoint. On la récupère via la liste détaillée :
      // on appelle directement listInvitations qui ne renvoie que des flags
      // booléens. Pour récupérer la clé publique, on utilise un GET dédié
      // qui n'expose pas la sealed (cf. /invitations/:token/recipient-key).
      // Pour rester KISS sur cette PR, on fait un seul GET — sealed-group-key
      // ne peut être lu sans token, donc on a besoin d'un endpoint admin
      // dédié. Approche retenue : la liste est étendue côté backend pour
      // exposer recipientPublicKeyHex aux admins (déjà fait dans le record).
      // Toutefois la liste actuelle ne renvoie que les flags booléens. On
      // utilise donc fetch direct vers GET /invitations/:token/sealed-group-key
      // qui renvoie aussi la clé publique. Le sealed n'existe pas encore →
      // 404. On utilise donc un appel détaillé via l'endpoint de récupération
      // adminée. SIMPLIFICATION : on récupère la clé publique dans le payload
      // de la liste admin (champ `recipientPublicKeyHex`).
      const detail = invitations.find((i) => i.token === inv.token);
      if (
        detail === undefined ||
        detail.hasRecipientPublicKey !== true ||
        typeof detail.recipientPublicKeyHex !== 'string' ||
        detail.recipientPublicKeyHex.length !== 64
      ) {
        setError(t('invitation.errorSealNoPubkey'));
        return;
      }
      const recipientPublicKey = fromHex(detail.recipientPublicKeyHex);
      const sealed = await sealedBoxEncrypt(groupKey, recipientPublicKey);
      await sealInvitation(inv.token, toHex(sealed));
      await refresh();
    } catch {
      setError(t('invitation.errorSealFailed'));
    } finally {
      setSealingToken(null);
    }
  };

  if (!authenticated) return null;

  // Trois groupes : aidants déjà installés (sync doc) ; invitations
  // « en attente d'acceptation » (recipientPublicKey absent) ; invitations
  // « en attente de finalisation » (pubkey présente, sealed absent).
  const pendingSealing = invitations.filter(
    (inv) => inv.hasRecipientPublicKey === true && inv.hasSealedGroupKey !== true,
  );
  const pendingAcceptance = invitations.filter((inv) => inv.hasRecipientPublicKey !== true);
  const sealedAndWaiting = invitations.filter(
    (inv) => inv.hasRecipientPublicKey === true && inv.hasSealedGroupKey === true,
  );

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

      {pendingSealing.length > 0 ? (
        <YStack gap="$2">
          <Text fontSize="$5" fontWeight="bold" testID="pending-seal-section">
            {t('invitation.pendingSealTitle')}
          </Text>
          <Text>{t('invitation.pendingSealHint')}</Text>
          {pendingSealing.map((inv) => (
            <Card key={inv.token} padding="$3" testID={`pending-seal-card-${inv.token}`}>
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
                  backgroundColor="$blue9"
                  color="white"
                  borderColor="$blue10"
                  borderWidth={2}
                  accessibilityLabel={t('invitation.sealCta')}
                  testID={`seal-button-${inv.token}`}
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

      {sealedAndWaiting.map((inv) => (
        <Card key={inv.token} padding="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontWeight="bold">{inv.displayName}</Text>
              <Text color="$gray10">{t('invitation.sealedAndWaiting')}</Text>
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
