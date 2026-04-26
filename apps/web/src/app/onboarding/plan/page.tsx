'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Stack, Text } from 'tamagui';
import {
  OnboardingAside,
  OnboardingCTA,
  OnboardingShell,
  PlanStep,
  type OnboardingShellCopy,
  type PlanStepValue,
} from '@kinhale/ui/onboarding';
import { projectPumps } from '@kinhale/sync';

import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';

// Conversion "HH:MM" → heure UTC entière (les minutes ne sont pas gérées
// par le format actuel `scheduledHoursUtc: number[]` ; KIN-038 prévoit
// un format plus précis post-v1.0).
function parseHour(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = parseInt(match[1] ?? '', 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export default function OnboardingPlanPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPlan = useDocStore((s) => s.appendPlan);
  const doc = useDocStore((s) => s.doc);

  const [value, setValue] = useState<PlanStepValue>({
    morningTime: '08:00',
    eveningTime: '20:00',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maintenancePumps =
    doc !== null
      ? projectPumps(doc).filter((p) => p.pumpType === 'maintenance' && !p.isExpired)
      : [];
  const targetPumpId = maintenancePumps[0]?.pumpId ?? null;

  const shellCopy: OnboardingShellCopy = {
    skip: t('onboarding.shellSkip'),
    back: t('onboarding.shellBack'),
  };

  const stepCopy = {
    title: t('onboarding.plan.stepTitle'),
    sub: t('onboarding.plan.stepSub'),
    morningLabel: t('onboarding.plan.morningLabel'),
    eveningLabel: t('onboarding.plan.eveningLabel'),
    plansTitle: t('onboarding.plan.plansTitle'),
    plansSub: t('onboarding.plan.plansSub'),
    greenLabel: t('onboarding.plan.greenLabel'),
    greenSub: t('onboarding.plan.greenSub'),
    yellowLabel: t('onboarding.plan.yellowLabel'),
    yellowSub: t('onboarding.plan.yellowSub'),
    redLabel: t('onboarding.plan.redLabel'),
    redSub: t('onboarding.plan.redSub'),
  };

  const handleContinue = async (): Promise<void> => {
    if (!online) return;
    setError(null);
    if (targetPumpId === null) {
      setError(t('onboarding.plan.noMaintenance'));
      return;
    }
    const morningHour = parseHour(value.morningTime);
    const eveningHour = parseHour(value.eveningTime);
    const scheduledHoursUtc = [morningHour, eveningHour].filter((h): h is number => h !== null);
    if (scheduledHoursUtc.length === 0) {
      setError(t('onboarding.plan.saveError'));
      return;
    }

    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      await appendPlan(
        {
          planId: crypto.randomUUID(),
          pumpId: targetPumpId,
          scheduledHoursUtc,
          startAtMs: Date.now(),
          endAtMs: null,
        },
        deviceId,
        kp.secretKey,
      );
      router.push('/onboarding/done');
    } catch {
      setError(t('onboarding.plan.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) return null;

  return (
    <OnboardingShell
      step="plan"
      copy={shellCopy}
      onBack={() => router.push('/onboarding/pump')}
      onSkip={() => router.push('/')}
      aside={
        <OnboardingAside
          step="plan"
          copy={{
            eyebrow: t('onboarding.plan.asideEyebrow'),
            title: t('onboarding.plan.asideTitle'),
            body: t('onboarding.plan.asideBody'),
          }}
        />
      }
      primaryCta={
        <OnboardingCTA
          label={t('onboarding.plan.stepCta')}
          loading={loading}
          loadingLabel={t('onboarding.plan.saving')}
          disabled={targetPumpId === null || !online}
          onPress={() => void handleContinue()}
          testID="onboarding-plan-cta"
        />
      }
    >
      <PlanStep copy={stepCopy} value={value} onChange={setValue} />

      {error !== null && (
        <Text color="$amberInk" fontSize={12} marginTop={12} role="alert">
          {error}
        </Text>
      )}

      {targetPumpId === null && (
        <Text color="$colorMore" fontSize={12} marginTop={12} fontStyle="italic">
          {t('onboarding.plan.noMaintenance')}
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
