'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Stack, Text } from 'tamagui';
import {
  OnboardingAside,
  OnboardingCTA,
  OnboardingShell,
  PumpsStep,
  type OnboardingShellCopy,
  type PumpsStepValue,
} from '@kinhale/ui/onboarding';

import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';

// Valeurs par défaut métier — la maquette ne demande qu'un toggle
// fond/secours, pas le détail des pompes. On crée des pompes initiales
// avec des valeurs raisonnables que l'utilisateur pourra ajuster plus
// tard via la page « Mes pompes » (à créer en PR-C).
const DEFAULT_TOTAL_DOSES = 200;
const DEFAULT_EXPIRY_OFFSET_MS = 365 * 24 * 60 * 60 * 1000; // 12 mois

export default function OnboardingPumpPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPump = useDocStore((s) => s.appendPump);

  const [pumps, setPumps] = useState<PumpsStepValue>({ maint: true, rescue: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shellCopy: OnboardingShellCopy = {
    skip: t('onboarding.shellSkip'),
    back: t('onboarding.shellBack'),
  };

  const stepCopy = {
    title: t('onboarding.pumps.title'),
    sub: t('onboarding.pumps.sub'),
    maintLabel: t('onboarding.pumps.maintLabel'),
    maintSub: t('onboarding.pumps.maintSub'),
    rescueLabel: t('onboarding.pumps.rescueLabel'),
    rescueSub: t('onboarding.pumps.rescueSub'),
  };

  const validSelection = pumps.maint || pumps.rescue;

  const handleContinue = async (): Promise<void> => {
    if (!online || !validSelection) return;
    setError(null);
    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      const expiresAtMs = Date.now() + DEFAULT_EXPIRY_OFFSET_MS;
      if (pumps.maint) {
        await appendPump(
          {
            pumpId: crypto.randomUUID(),
            name: 'Fluticasone',
            pumpType: 'maintenance',
            totalDoses: DEFAULT_TOTAL_DOSES,
            expiresAtMs,
          },
          deviceId,
          kp.secretKey,
        );
      }
      if (pumps.rescue) {
        await appendPump(
          {
            pumpId: crypto.randomUUID(),
            name: 'Salbutamol',
            pumpType: 'rescue',
            totalDoses: DEFAULT_TOTAL_DOSES,
            expiresAtMs,
          },
          deviceId,
          kp.secretKey,
        );
      }
      router.push('/onboarding/plan');
    } catch {
      setError(t('onboarding.pump.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = !validSelection ? t('onboarding.pumps.atLeastOne') : error;

  if (!authenticated) return null;

  return (
    <OnboardingShell
      step="pumps"
      copy={shellCopy}
      onBack={() => router.push('/onboarding/child')}
      onSkip={() => router.push('/')}
      aside={
        <OnboardingAside
          step="pumps"
          copy={{
            eyebrow: t('onboarding.pumps.asideEyebrow'),
            title: t('onboarding.pumps.asideTitle'),
            body: t('onboarding.pumps.asideBody'),
          }}
        />
      }
      primaryCta={
        <OnboardingCTA
          label={t('onboarding.pumps.cta')}
          loading={loading}
          loadingLabel={t('onboarding.pump.saving')}
          disabled={!validSelection || !online}
          onPress={() => void handleContinue()}
          testID="onboarding-pumps-cta"
        />
      }
    >
      <PumpsStep copy={stepCopy} value={pumps} onChange={setPumps} />

      {errorMessage !== null && (
        <Text color="$amberInk" fontSize={12} marginTop={12} role="alert">
          {errorMessage}
        </Text>
      )}

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
    </OnboardingShell>
  );
}
