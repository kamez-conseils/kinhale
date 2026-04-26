import React, { useEffect, useMemo, useState, type JSX } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useAuthStore } from '../../../src/stores/auth-store';
import { useDocStore } from '../../../src/stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../src/lib/device';
import { useRelay } from '../../../src/hooks/use-relay';

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

export default function ResolveConflictScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ doseId: string }>();
  const doseId = typeof params.doseId === 'string' ? params.doseId : '';
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

  // Mapping caregiverId → displayName. Hypothèse v1.0 : caregiverId === deviceId.
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

  if (dose === null || partner === null) {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.resolveModal.title')}</H1>
        <Text color="$red10" accessibilityRole="alert">
          {t('journal.dose.resolveModal.missingPair')}
        </Text>
        <Button onPress={() => router.replace('/journal')} accessible accessibilityRole="button">
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
      void kept;
      router.replace('/journal');
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
        />
        <DosePane
          dose={partner}
          caregiverName={resolveCaregiverName(partner.deviceId)}
          t={t}
          onKeep={() => void handleKeep(partner, dose)}
          loading={loading}
        />
      </XStack>

      {error !== null && (
        <Text accessibilityRole="alert" color="$red10">
          {error}
        </Text>
      )}

      <Button
        onPress={() => router.replace('/journal')}
        theme="gray"
        accessible
        accessibilityRole="button"
      >
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
}

function DosePane({ dose, caregiverName, t, onKeep, loading }: DosePaneProps): JSX.Element {
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
      <Button onPress={onKeep} disabled={loading} accessible accessibilityRole="button">
        {t('journal.dose.resolveModal.keepThis')}
      </Button>
    </YStack>
  );
}
