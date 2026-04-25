'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack, Input } from 'tamagui';
import {
  projectDoses,
  VOIDED_REASON_MAX_LENGTH,
  type DoseVoidedPayload,
  type ProjectedDose,
} from '@kinhale/sync';
import { useAuthStore } from '../../../../stores/auth-store';
import { useDocStore } from '../../../../stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../../lib/device';
import { useRelay } from '../../../../hooks/use-relay';
import { useRequireAuth } from '../../../../lib/useRequireAuth';

export default function VoidDosePage(): React.JSX.Element | null {
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
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dose: ProjectedDose | null = useMemo(() => {
    if (doc === null) return null;
    return projectDoses(doc).find((d) => d.doseId === doseId) ?? null;
  }, [doc, doseId]);

  useEffect(() => {
    if (householdId !== '') {
      getGroupKey(householdId)
        .then(setGroupKey)
        .catch(() => undefined);
    }
  }, [householdId]);

  const { sendChanges } = useRelay(accessToken, groupKey);

  if (!authenticated) return null;
  if (dose === null || dose.status === 'voided') {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.voidModal.title')}</H1>
        <Text role="alert" color="$red10">
          {t('journal.dose.editPermission.voided')}
        </Text>
        <Button onPress={() => router.push('/journal')}>
          {t('journal.dose.resolveModal.back')}
        </Button>
      </YStack>
    );
  }

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError(t('journal.dose.voidModal.reasonRequired'));
      return;
    }
    if (trimmed.length > VOIDED_REASON_MAX_LENGTH) {
      setError(t('journal.dose.voidModal.reasonTooLong'));
      return;
    }

    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      const payload: DoseVoidedPayload = {
        doseId: dose.doseId,
        voidedByDeviceId: deviceId,
        voidedAtMs: Date.now(),
        voidedReason: trimmed,
      };
      const changes = await appendDoseVoid(payload, deviceId, kp.secretKey);
      if (groupKey !== null) {
        await sendChanges(changes, groupKey);
      }
      router.push('/journal');
    } catch {
      setError(t('journal.dose.voidModal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.dose.voidModal.title')}</H1>
      <Text color="$color10">{t('journal.dose.voidModal.warning')}</Text>

      <Text fontWeight="600">{t('journal.dose.voidModal.reasonLabel')}</Text>
      <Input
        value={reason}
        onChangeText={setReason}
        placeholder={t('journal.dose.voidModal.reasonPlaceholder')}
        testID="void-reason"
      />

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <XStack gap="$2">
        <Button flex={1} onPress={() => router.push('/journal')} theme="gray" testID="void-cancel">
          {t('journal.dose.voidModal.cancel')}
        </Button>
        <Button
          flex={1}
          onPress={() => void handleSubmit()}
          disabled={loading}
          theme="red"
          testID="void-submit"
        >
          {loading ? t('journal.saving') : t('journal.dose.voidModal.submit')}
        </Button>
      </XStack>
    </YStack>
  );
}
