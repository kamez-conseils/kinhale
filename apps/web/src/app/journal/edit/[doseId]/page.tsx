'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack, Input } from 'tamagui';
import {
  projectCaregivers,
  projectDoses,
  VOIDED_REASON_MAX_LENGTH,
  type DoseEditedPayload,
  type ProjectedDose,
} from '@kinhale/sync';
import { canEditDose } from '@kinhale/domain/entities';
import type { Role } from '@kinhale/domain/entities';
import { useAuthStore } from '../../../../stores/auth-store';
import { useDocStore } from '../../../../stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../../lib/device';
import { useRelay } from '../../../../hooks/use-relay';
import { useRequireAuth } from '../../../../lib/useRequireAuth';

const SYMPTOMS = ['cough', 'wheezing', 'shortness_of_breath', 'chest_tightness'] as const;

function deriveCurrentRole(
  caregivers: ReadonlyArray<{ caregiverId: string; role: string }>,
  deviceId: string | null,
): Role {
  if (deviceId === null) return 'contributor';
  const me = caregivers.find((c) => c.caregiverId === deviceId);
  if (me === undefined) return 'contributor';
  if (me.role === 'admin' || me.role === 'restricted_contributor' || me.role === 'contributor') {
    return me.role;
  }
  return 'contributor';
}

export default function EditDosePage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useParams<{ doseId: string }>();
  const doseId = params?.doseId ?? '';
  const authenticated = useRequireAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const householdId = useAuthStore((s) => s.householdId) ?? '';
  const doc = useDocStore((s) => s.doc);
  const appendDoseEdit = useDocStore((s) => s.appendDoseEdit);

  const [groupKey, setGroupKey] = useState<Uint8Array | null>(null);
  const [dosesValue, setDosesValue] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [administeredAtMs, setAdministeredAtMs] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dose: ProjectedDose | null = useMemo(() => {
    if (doc === null) return null;
    const doses = projectDoses(doc);
    return doses.find((d) => d.doseId === doseId) ?? null;
  }, [doc, doseId]);

  const currentRole = useMemo(
    () => deriveCurrentRole(doc !== null ? projectCaregivers(doc) : [], deviceId),
    [doc, deviceId],
  );

  useEffect(() => {
    if (householdId !== '') {
      getGroupKey(householdId)
        .then(setGroupKey)
        .catch(() => undefined);
    }
  }, [householdId]);

  useEffect(() => {
    if (dose !== null) {
      setDosesValue(String(dose.dosesAdministered));
      setSymptoms([...dose.symptoms]);
      setAdministeredAtMs(String(dose.administeredAtMs));
    }
  }, [dose]);

  const { sendChanges } = useRelay(accessToken, groupKey);

  if (!authenticated) return null;
  if (dose === null) {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.editModal.title')}</H1>
        <Text role="alert" color="$red10">
          {t('journal.dose.resolveModal.missingPair')}
        </Text>
        <Button onPress={() => router.push('/journal')}>
          {t('journal.dose.resolveModal.back')}
        </Button>
      </YStack>
    );
  }

  const verdict = canEditDose({
    dose: {
      recordedByDeviceId: dose.deviceId,
      administeredAtMs: dose.administeredAtMs,
      status: dose.status,
    },
    currentDeviceId: deviceId,
    currentRole,
    nowMs: Date.now(),
  });

  if (!verdict.allowed) {
    const refusalKey =
      verdict.reason === 'voided'
        ? 'journal.dose.editPermission.voided'
        : verdict.reason === 'pending_review'
          ? 'journal.dose.editPermission.pendingReview'
          : verdict.reason === 'restricted_role'
            ? 'journal.dose.editPermission.restrictedRole'
            : 'journal.dose.editPermission.tooEarly';
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.editModal.title')}</H1>
        <Text role="alert" color="$orange11">
          {t(refusalKey)}
        </Text>
        {verdict.reason === 'not_author_and_too_old' && (
          <Text color="$color10">{t('journal.dose.editPermission.adminOnly')}</Text>
        )}
        <Button onPress={() => router.push('/journal')}>
          {t('journal.dose.resolveModal.back')}
        </Button>
      </YStack>
    );
  }

  const requiresReason = verdict.requiresReason;

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    const dosesNumber = Number(dosesValue);
    if (!Number.isFinite(dosesNumber) || dosesNumber < 0) {
      setError(t('journal.dose.editModal.saveError'));
      return;
    }
    const adminAtNumber = Number(administeredAtMs);
    if (!Number.isFinite(adminAtNumber)) {
      setError(t('journal.dose.editModal.saveError'));
      return;
    }
    const trimmedReason = reason.trim();
    if (requiresReason && trimmedReason.length === 0) {
      setError(t('journal.dose.editModal.reasonRequired'));
      return;
    }
    if (trimmedReason.length > VOIDED_REASON_MAX_LENGTH) {
      setError(t('journal.dose.editModal.reasonTooLong'));
      return;
    }

    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      const payload: DoseEditedPayload = {
        doseId: dose.doseId,
        patch: {
          administeredAtMs: adminAtNumber,
          dosesAdministered: dosesNumber,
          symptoms,
        },
        editedByDeviceId: deviceId,
        editedAtMs: Date.now(),
        ...(trimmedReason.length > 0 ? { reason: trimmedReason } : {}),
      };
      const changes = await appendDoseEdit(payload, deviceId, kp.secretKey);
      if (groupKey !== null) {
        await sendChanges(changes, groupKey);
      }
      router.push('/journal');
    } catch {
      setError(t('journal.dose.editModal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.dose.editModal.title')}</H1>

      <Text fontWeight="600">{t('journal.dose.editModal.administeredAtLabel')}</Text>
      <Input
        value={administeredAtMs}
        onChangeText={setAdministeredAtMs}
        keyboardType="numeric"
        testID="edit-administered-at"
      />

      <Text fontWeight="600">{t('journal.dose.editModal.dosesLabel')}</Text>
      <Input
        value={dosesValue}
        onChangeText={setDosesValue}
        keyboardType="numeric"
        testID="edit-doses"
      />

      <Text fontWeight="600">{t('journal.dose.editModal.symptomsLabel')}</Text>
      <XStack flexWrap="wrap" gap="$2">
        {SYMPTOMS.map((s) => (
          <Button
            key={s}
            size="$3"
            onPress={() =>
              setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
            }
            backgroundColor={symptoms.includes(s) ? '$blue9' : '$backgroundHover'}
            color={symptoms.includes(s) ? 'white' : '$color'}
            borderWidth={1}
            borderColor={symptoms.includes(s) ? '$blue10' : '$borderColor'}
          >
            {t(`journal.symptom.${s}`)}
          </Button>
        ))}
      </XStack>

      {requiresReason && (
        <>
          <Text fontWeight="600">{t('journal.dose.editModal.reasonLabel')}</Text>
          <Input
            value={reason}
            onChangeText={setReason}
            placeholder={t('journal.dose.editModal.reasonPlaceholder')}
            testID="edit-reason"
          />
        </>
      )}

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <XStack gap="$2">
        <Button flex={1} onPress={() => router.push('/journal')} theme="gray" testID="edit-cancel">
          {t('journal.dose.editModal.cancel')}
        </Button>
        <Button
          flex={1}
          onPress={() => void handleSubmit()}
          disabled={loading}
          testID="edit-submit"
        >
          {loading ? t('journal.saving') : t('journal.dose.editModal.submit')}
        </Button>
      </XStack>
    </YStack>
  );
}
