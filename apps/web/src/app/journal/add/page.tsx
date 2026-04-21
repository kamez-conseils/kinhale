'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack } from 'tamagui';
import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../lib/device';
import { useRelay } from '../../../hooks/use-relay';

export default function AddDosePage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const householdId = useAuthStore((s) => s.householdId) ?? '';
  const appendDose = useDocStore((s) => s.appendDose);
  const [doseType, setDoseType] = useState<'maintenance' | 'rescue'>('maintenance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (householdId !== '') {
      getGroupKey(householdId)
        .then(setGroupKey)
        .catch(() => {
          // silent — relay just won't connect
        });
    }
  }, [householdId]);

  const { sendChanges } = useRelay(accessToken, groupKey);

  const handleSave = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const kp = await getOrCreateDevice();
      const payload = {
        doseId: crypto.randomUUID(),
        pumpId: 'default-pump',
        childId: 'default-child',
        caregiverId: deviceId,
        administeredAtMs: Date.now(),
        doseType,
        dosesAdministered: 1,
        symptoms: [],
        circumstances: [],
        freeFormTag: null,
      };
      const changes = await appendDose(payload, deviceId, kp.secretKey);
      if (groupKey !== null) {
        await sendChanges(changes, groupKey);
      }
      router.push('/journal');
    } catch {
      setError(t('journal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.addTitle')}</H1>
      <Text fontWeight="600">{t('journal.doseType')}</Text>
      <XStack gap="$3">
        <Button
          flex={1}
          onPress={() => setDoseType('maintenance')}
          theme={doseType === 'maintenance' ? 'active' : null}
        >
          {t('journal.maintenance')}
        </Button>
        <Button
          flex={1}
          onPress={() => setDoseType('rescue')}
          theme={doseType === 'rescue' ? 'active' : null}
        >
          {t('journal.rescue')}
        </Button>
      </XStack>
      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}
      <Button onPress={() => void handleSave()} disabled={loading} marginTop="$2">
        {loading ? t('journal.saving') : t('journal.save')}
      </Button>
    </YStack>
  );
}
