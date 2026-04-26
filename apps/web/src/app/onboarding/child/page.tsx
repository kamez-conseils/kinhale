'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Input, Stack, Text, YStack } from 'tamagui';
import {
  OnboardingCTA,
  OnboardingShell,
  WelcomeStep,
  type OnboardingShellCopy,
} from '@kinhale/ui/onboarding';

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

  const shellCopy: OnboardingShellCopy = {
    skip: t('onboarding.shellSkip'),
    back: t('onboarding.shellBack'),
  };

  const welcomeCopy = {
    title: t('onboarding.welcome.title'),
    sub: t('onboarding.welcome.sub'),
    nameLabel: t('onboarding.welcome.nameLabel'),
    namePlaceholder: t('onboarding.welcome.namePlaceholder'),
    foot: t('onboarding.welcome.foot'),
  };

  const trimmedName = firstName.trim();
  const validName = trimmedName.length > 0;

  const handleContinue = async (): Promise<void> => {
    if (!online || !validName) return;
    setError(null);
    const birthYearRaw = birthYearStr.trim();
    const birthYear = birthYearRaw === '' ? new Date().getFullYear() : parseInt(birthYearRaw, 10);
    if (Number.isNaN(birthYear)) {
      setError(t('onboarding.child.saveError'));
      return;
    }
    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      await appendChild(
        { childId: crypto.randomUUID(), firstName: trimmedName, birthYear },
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

  const errorMessage =
    !validName && firstName.length > 0 ? t('onboarding.errors.nameRequired') : error;

  if (!authenticated) return null;

  return (
    <OnboardingShell
      step="welcome"
      copy={shellCopy}
      onSkip={() => router.push('/')}
      primaryCta={
        <OnboardingCTA
          label={t('onboarding.welcome.cta')}
          loading={loading}
          loadingLabel={t('onboarding.child.saving')}
          disabled={!validName || !online}
          onPress={() => void handleContinue()}
          testID="onboarding-welcome-cta"
        />
      }
    >
      {/* Onboarding écran 1 : disclaimer complet RM27 affiché d'entrée. */}
      <DisclaimerBanner />

      <WelcomeStep
        copy={welcomeCopy}
        value={firstName}
        onChange={setFirstName}
        errorMessage={errorMessage}
      />

      {/* Champ année de naissance — gardé pour la couverture métier
          historique (la maquette ne le demande pas). Affiché plus bas, en
          option visuelle plus discrète. */}
      <YStack width="100%" gap={8} marginTop={20}>
        <Text
          tag="label"
          htmlFor="kinhale-onb-birth-year"
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.88}
          fontWeight="600"
        >
          {t('onboarding.child.birthYearLabel')}
        </Text>
        <Input
          id="kinhale-onb-birth-year"
          unstyled
          width="100%"
          paddingHorizontal={16}
          paddingVertical={14}
          backgroundColor="$surface"
          borderWidth={1.5}
          borderColor="$borderColor"
          borderRadius={12}
          fontSize={16}
          color="$color"
          placeholderTextColor="$colorFaint"
          value={birthYearStr}
          onChangeText={setBirthYearStr}
          placeholder={t('onboarding.child.birthYearPlaceholder')}
          keyboardType="number-pad"
          aria-label={t('onboarding.child.birthYearLabel')}
        />
      </YStack>

      {!online && (
        <Stack
          marginTop={12}
          paddingHorizontal={14}
          paddingVertical={10}
          borderRadius={10}
          backgroundColor="$amberSoft"
        >
          <Text color="$amberInk" fontSize={12} testID="offline-guard-message" role="status">
            {t('offlineGuard.message')}
          </Text>
        </Stack>
      )}

      {/* Pied E10 : version discrète sur chaque étape onboarding. */}
      <Stack marginTop={20} alignItems="center">
        <DisclaimerFooter />
      </Stack>
    </OnboardingShell>
  );
}
