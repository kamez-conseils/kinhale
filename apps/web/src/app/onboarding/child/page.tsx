'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, Input } from 'tamagui';
import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';
import { DisclaimerBanner, DisclaimerFooter } from '../../../components/DisclaimerFooter';

export default function OnboardingChildPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendChild = useDocStore((s) => s.appendChild);

  const [firstName, setFirstName] = useState('');
  const [birthYearStr, setBirthYearStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    // Défense en profondeur : cf. kz-securite-075-078 §m1.
    if (!online) return;
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

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$4">
      {/* Onboarding écran 1 : disclaimer complet RM27 affiché d'entrée. */}
      <DisclaimerBanner />
      <H1>{t('onboarding.child.title')}</H1>
      <Text fontWeight="600">{t('onboarding.child.firstNameLabel')}</Text>
      <Input
        value={firstName}
        onChangeText={setFirstName}
        placeholder={t('onboarding.child.firstNamePlaceholder')}
      />
      <Text fontWeight="600">{t('onboarding.child.birthYearLabel')}</Text>
      <Input
        value={birthYearStr}
        onChangeText={setBirthYearStr}
        placeholder={t('onboarding.child.birthYearPlaceholder')}
      />
      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}
      {!online ? (
        <Text color="$orange10" testID="offline-guard-message" role="status">
          {t('offlineGuard.message')}
        </Text>
      ) : null}
      <Button onPress={() => void handleSave()} disabled={loading || !online} marginTop="$2">
        {loading ? t('onboarding.child.saving') : t('onboarding.child.save')}
      </Button>
      {/* Pied E10 : version discrète sur chaque étape onboarding. */}
      <DisclaimerFooter />
    </YStack>
  );
}
