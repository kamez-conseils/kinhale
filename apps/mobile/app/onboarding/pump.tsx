import React, { useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, Input, XStack } from 'tamagui';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';
import { getOrCreateDevice } from '../../src/lib/device';

export default function OnboardingPumpScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
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

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('onboarding.pump.title')}</H1>
      <Text fontWeight="600">{t('onboarding.pump.nameLabel')}</Text>
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t('onboarding.pump.namePlaceholder')}
        accessible
        accessibilityLabel={t('onboarding.pump.nameLabel')}
      />
      <Text fontWeight="600">{t('onboarding.pump.typeLabel')}</Text>
      <XStack gap="$3">
        <Button
          flex={1}
          onPress={() => setPumpType('maintenance')}
          theme={pumpType === 'maintenance' ? 'active' : null}
          accessible
          accessibilityRole="button"
        >
          {t('onboarding.pump.typeMaintenance')}
        </Button>
        <Button
          flex={1}
          onPress={() => setPumpType('rescue')}
          theme={pumpType === 'rescue' ? 'active' : null}
          accessible
          accessibilityRole="button"
        >
          {t('onboarding.pump.typeRescue')}
        </Button>
      </XStack>
      <Text fontWeight="600">{t('onboarding.pump.totalDosesLabel')}</Text>
      <Input
        value={totalDosesStr}
        onChangeText={setTotalDosesStr}
        placeholder={t('onboarding.pump.totalDosesPlaceholder')}
        keyboardType="numeric"
        accessible
        accessibilityLabel={t('onboarding.pump.totalDosesLabel')}
      />
      <Text fontWeight="600">{t('onboarding.pump.expiresAtLabel')}</Text>
      <Input
        value={expiresAtStr}
        onChangeText={setExpiresAtStr}
        placeholder={t('onboarding.pump.expiresAtPlaceholder')}
        accessible
        accessibilityLabel={t('onboarding.pump.expiresAtLabel')}
      />
      {error !== null && (
        <Text accessibilityRole="alert" color="$red10">
          {error}
        </Text>
      )}
      <Button
        onPress={() => void handleSave()}
        disabled={loading}
        marginTop="$2"
        accessible
        accessibilityRole="button"
      >
        {loading ? t('onboarding.pump.saving') : t('onboarding.pump.save')}
      </Button>
    </YStack>
  );
}
