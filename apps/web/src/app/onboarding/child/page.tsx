'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Stack, Text } from 'tamagui';
import {
  OnboardingAside,
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

// Année de naissance par défaut : âge enfant typique 5 ans (la maquette
// `Kinhale Onboarding.html` step 0 ne demande que le prénom, donc on
// donne une valeur métier raisonnable que l'utilisateur pourra ajuster
// plus tard via le profil enfant).
const DEFAULT_BIRTH_YEAR_OFFSET = 5;

export default function OnboardingChildPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendChild = useDocStore((s) => s.appendChild);

  const [firstName, setFirstName] = useState('');
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
    const birthYear = new Date().getFullYear() - DEFAULT_BIRTH_YEAR_OFFSET;
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
      aside={
        <OnboardingAside
          step="welcome"
          copy={{
            eyebrow: t('onboarding.welcome.asideEyebrow'),
            title: t('onboarding.welcome.asideTitle'),
            body: t('onboarding.welcome.asideBody'),
          }}
        />
      }
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
      <WelcomeStep
        copy={welcomeCopy}
        value={firstName}
        onChange={setFirstName}
        errorMessage={errorMessage}
      />

      {!online && (
        <Stack
          marginTop={16}
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
    </OnboardingShell>
  );
}
