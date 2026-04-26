import React, { useEffect, useMemo, useState, type JSX } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack, Input } from 'tamagui';
import {
  projectDoses,
  VOIDED_REASON_MAX_LENGTH,
  type DoseVoidedPayload,
  type ProjectedDose,
} from '@kinhale/sync';
import { useAuthStore } from '../../../src/stores/auth-store';
import { useDocStore } from '../../../src/stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../src/lib/device';
import { useRelay } from '../../../src/hooks/use-relay';

export default function VoidDoseScreen(): JSX.Element {
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

  if (dose === null || dose.status === 'voided') {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('journal.dose.voidModal.title')}</H1>
        <Text color="$red10" accessibilityRole="alert">
          {t('journal.dose.editPermission.voided')}
        </Text>
        <Button onPress={() => router.replace('/journal')} accessible accessibilityRole="button">
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
      router.replace('/journal');
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
        accessible
        accessibilityLabel={t('journal.dose.voidModal.reasonLabel')}
      />

      {error !== null && (
        <Text accessibilityRole="alert" color="$red10">
          {error}
        </Text>
      )}

      <XStack gap="$2">
        <Button
          flex={1}
          onPress={() => router.replace('/journal')}
          theme="gray"
          accessible
          accessibilityRole="button"
        >
          {t('journal.dose.voidModal.cancel')}
        </Button>
        <Button
          flex={1}
          onPress={() => void handleSubmit()}
          disabled={loading}
          theme="red"
          accessible
          accessibilityRole="button"
        >
          {loading ? t('journal.saving') : t('journal.dose.voidModal.submit')}
        </Button>
      </XStack>
    </YStack>
  );
}
