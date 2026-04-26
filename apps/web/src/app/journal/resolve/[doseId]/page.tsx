'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack } from 'tamagui';
import {
  projectCaregivers,
  projectDoses,
  VOIDED_REASON_DUPLICATE_RESOLVED,
  type DoseReviewFlaggedPayload,
  type DoseVoidedPayload,
  type ProjectedDose,
} from '@kinhale/sync';
import { useAuthStore } from '../../../../stores/auth-store';
import { useDocStore } from '../../../../stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../../lib/device';
import { useRelay } from '../../../../hooks/use-relay';
import { useRequireAuth } from '../../../../lib/useRequireAuth';

/**
 * Cherche dans les événements `DoseReviewFlagged` la paire qui contient
 * `doseId`. Renvoie l'autre `doseId` du conflit ou `null`.
 *
 * Une dose peut figurer dans plusieurs paires (rare mais possible) — on
 * retourne la première trouvée. Une amélioration future pourrait afficher
 * une liste de choix si plus de deux doses sont impliquées.
 */
function findConflictPartner(
  doc: { events: ReadonlyArray<{ type: string; payloadJson: string }> } | null,
  doseId: string,
): string | null {
  if (doc === null) return null;
  for (const event of doc.events) {
    if (event.type !== 'DoseReviewFlagged') continue;
    let payload: DoseReviewFlaggedPayload;
    try {
      payload = JSON.parse(event.payloadJson) as DoseReviewFlaggedPayload;
    } catch {
      continue;
    }
    if (!Array.isArray(payload.doseIds) || payload.doseIds.length < 2) continue;
    const [a, b] = payload.doseIds;
    if (a === doseId && typeof b === 'string') return b;
    if (b === doseId && typeof a === 'string') return a;
  }
  return null;
}

export default function ResolveConflictPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useParams<{ doseId: string }>();
  const doseId = params?.doseId ?? '';
  const authenticated = useRequireAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const householdId = useAuthStore((s) => s.householdId) ?? '';
  const doc = useDocStore((s) => s.doc);
  const appendDoseVoid = useDocStore((s) => s.appendDoseVoid);

  const [groupKey, setGroupKey] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doses = useMemo(() => (doc !== null ? projectDoses(doc) : []), [doc]);
  const caregivers = useMemo(() => (doc !== null ? projectCaregivers(doc) : []), [doc]);
  const dose = doses.find((d) => d.doseId === doseId) ?? null;
  const partnerId = findConflictPartner(doc, doseId);
  const partner = partnerId === null ? null : (doses.find((d) => d.doseId === partnerId) ?? null);

  // Mapping `caregiverId → displayName`. Hypothèse v1.0 :
  // caregiverId === deviceId (1 device par aidant). Si le mapping échoue,
  // on affiche un fallback opaque (4 derniers chars de l'identifiant).
  const caregiverNameByCaregiverId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of caregivers) m.set(c.caregiverId, c.displayName);
    return m;
  }, [caregivers]);
  const resolveCaregiverName = (deviceId: string): string => {
    const name = caregiverNameByCaregiverId.get(deviceId);
    if (name !== undefined) return name;
    return t('journal.dose.unknownCaregiver', { id: deviceId.slice(-4) });
  };

  useEffect(() => {
    if (householdId !== '') {
      getGroupKey(householdId)
        .then(setGroupKey)
        .catch(() => undefined);
    }
  }, [householdId]);

  const { sendChanges } = useRelay(accessToken, groupKey);

  if (!authenticated) return null;
  if (dose === null || partner === null) {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.resolveModal.title')}</H1>
        <Text role="alert" color="$red10">
          {t('journal.dose.resolveModal.missingPair')}
        </Text>
        <Button onPress={() => router.push('/journal')}>
          {t('journal.dose.resolveModal.back')}
        </Button>
      </YStack>
    );
  }

  const handleKeep = async (kept: ProjectedDose, voided: ProjectedDose): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      const payload: DoseVoidedPayload = {
        doseId: voided.doseId,
        voidedByDeviceId: deviceId,
        voidedAtMs: Date.now(),
        voidedReason: VOIDED_REASON_DUPLICATE_RESOLVED,
      };
      const changes = await appendDoseVoid(payload, deviceId, kp.secretKey);
      if (groupKey !== null) {
        await sendChanges(changes, groupKey);
      }
      // `kept` reste tel quel — la projection cessera de la flagger
      // `pending_review` dès que toutes les doses du flag seront soit
      // résolues soit voidées (l'autre est désormais voidée).
      void kept;
      router.push('/journal');
    } catch {
      setError(t('journal.dose.resolveModal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.dose.resolveModal.title')}</H1>
      <Text color="$color10">{t('journal.dose.resolveModal.intro')}</Text>

      <XStack gap="$3" flexWrap="wrap">
        <DosePane
          dose={dose}
          caregiverName={resolveCaregiverName(dose.deviceId)}
          t={t}
          onKeep={() => void handleKeep(dose, partner)}
          loading={loading}
          testID={`resolve-keep-${dose.doseId}`}
        />
        <DosePane
          dose={partner}
          caregiverName={resolveCaregiverName(partner.deviceId)}
          t={t}
          onKeep={() => void handleKeep(partner, dose)}
          loading={loading}
          testID={`resolve-keep-${partner.doseId}`}
        />
      </XStack>

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <Button onPress={() => router.push('/journal')} theme="gray">
        {t('journal.dose.resolveModal.back')}
      </Button>
    </YStack>
  );
}

interface DosePaneProps {
  readonly dose: ProjectedDose;
  readonly caregiverName: string;
  readonly t: (key: string) => string;
  readonly onKeep: () => void;
  readonly loading: boolean;
  readonly testID: string;
}

function DosePane({
  dose,
  caregiverName,
  t,
  onKeep,
  loading,
  testID,
}: DosePaneProps): React.JSX.Element {
  const labelKey = dose.doseType === 'rescue' ? 'journal.rescue' : 'journal.maintenance';
  return (
    <YStack
      flex={1}
      minWidth={240}
      padding="$3"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$3"
      gap="$2"
    >
      <Text fontSize="$4" fontWeight="700">
        {t(labelKey)}
      </Text>
      <Text fontSize="$2" color="$color9">
        {new Date(dose.administeredAtMs).toLocaleString()}
      </Text>
      <Text fontSize="$3">{`${t('journal.dose.editModal.dosesLabel')} : ${String(dose.dosesAdministered)}`}</Text>
      <Text fontSize="$2" color="$color10">
        {`${t('journal.dose.caregiverLabel')} : ${caregiverName}`}
      </Text>
      <Button onPress={onKeep} disabled={loading} testID={testID}>
        {t('journal.dose.resolveModal.keepThis')}
      </Button>
    </YStack>
  );
}
