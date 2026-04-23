'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, Input, XStack } from 'tamagui';
import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';

export default function OnboardingPumpPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPump = useDocStore((s) => s.appendPump);

  const [name, setName] = useState('');
  const [pumpType, setPumpType] = useState<'maintenance' | 'rescue'>('maintenance');
  const [totalDosesStr, setTotalDosesStr] = useState('');
  const [expiresAtStr, setExpiresAtStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    setError(null);
    const totalDoses = parseInt(totalDosesStr, 10);
    if (name.trim() === '' || isNaN(totalDoses) || totalDoses <= 0) {
      setError(t('onboarding.pump.saveError'));
      return;
    }
    const expiresAtMs = expiresAtStr.trim() !== '' ? new Date(expiresAtStr.trim()).getTime() : null;

    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      await appendPump(
        { pumpId: crypto.randomUUID(), name: name.trim(), pumpType, totalDoses, expiresAtMs },
        deviceId,
        kp.secretKey,
      );
      router.push('/onboarding/plan');
    } catch {
      setError(t('onboarding.pump.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('onboarding.pump.title')}</H1>

      <Text fontWeight="600">{t('onboarding.pump.nameLabel')}</Text>
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t('onboarding.pump.namePlaceholder')}
      />

      <Text fontWeight="600">{t('onboarding.pump.typeLabel')}</Text>
      <XStack gap="$3">
        <Button
          flex={1}
          onPress={() => setPumpType('maintenance')}
          backgroundColor={pumpType === 'maintenance' ? '$blue9' : '$backgroundStrong'}
          color={pumpType === 'maintenance' ? 'white' : '$color'}
          borderColor={pumpType === 'maintenance' ? '$blue10' : '$borderColor'}
          borderWidth={2}
        >
          {t('onboarding.pump.typeMaintenance')}
        </Button>
        <Button
          flex={1}
          onPress={() => setPumpType('rescue')}
          backgroundColor={pumpType === 'rescue' ? '$blue9' : '$backgroundStrong'}
          color={pumpType === 'rescue' ? 'white' : '$color'}
          borderColor={pumpType === 'rescue' ? '$blue10' : '$borderColor'}
          borderWidth={2}
        >
          {t('onboarding.pump.typeRescue')}
        </Button>
      </XStack>

      <Text fontWeight="600">{t('onboarding.pump.totalDosesLabel')}</Text>
      <Input
        value={totalDosesStr}
        onChangeText={setTotalDosesStr}
        placeholder={t('onboarding.pump.totalDosesPlaceholder')}
      />

      <Text fontWeight="600">{t('onboarding.pump.expiresAtLabel')}</Text>
      <Input
        value={expiresAtStr}
        onChangeText={setExpiresAtStr}
        placeholder={t('onboarding.pump.expiresAtPlaceholder')}
      />

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <Button onPress={() => void handleSave()} disabled={loading} marginTop="$2">
        {loading ? t('onboarding.pump.saving') : t('onboarding.pump.save')}
      </Button>
    </YStack>
  );
}
