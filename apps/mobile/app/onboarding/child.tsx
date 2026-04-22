import React, { useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, Input } from 'tamagui';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';
import { getOrCreateDevice } from '../../src/lib/device';

export default function OnboardingChildScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendChild = useDocStore((s) => s.appendChild);

  const [firstName, setFirstName] = useState('');
  const [birthYearStr, setBirthYearStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    setError(null);
    const birthYear = parseInt(birthYearStr, 10);
    if (firstName.trim() === '' || isNaN(birthYear)) {
      setError(t('onboarding.child.saveError'));
      return;
    }
    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      await appendChild(
        { childId: crypto.randomUUID(), firstName: firstName.trim(), birthYear },
        deviceId,
        kp.secretKey,
      );
      router.push('/onboarding/pump');
    } catch {
      setError(t('onboarding.child.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('onboarding.child.title')}</H1>
      <Text fontWeight="600">{t('onboarding.child.firstNameLabel')}</Text>
      <Input
        value={firstName}
        onChangeText={setFirstName}
        placeholder={t('onboarding.child.firstNamePlaceholder')}
        accessible
        accessibilityLabel={t('onboarding.child.firstNameLabel')}
      />
      <Text fontWeight="600">{t('onboarding.child.birthYearLabel')}</Text>
      <Input
        value={birthYearStr}
        onChangeText={setBirthYearStr}
        placeholder={t('onboarding.child.birthYearPlaceholder')}
        keyboardType="numeric"
        accessible
        accessibilityLabel={t('onboarding.child.birthYearLabel')}
      />
      {error !== null && (
        <Text accessibilityRole="alert" color="$red10">{error}</Text>
      )}
      <Button
        onPress={() => void handleSave()}
        disabled={loading}
        marginTop="$2"
        accessible
        accessibilityRole="button"
      >
        {loading ? t('onboarding.child.saving') : t('onboarding.child.save')}
      </Button>
    </YStack>
  );
}
