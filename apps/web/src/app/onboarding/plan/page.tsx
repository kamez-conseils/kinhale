'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, Input, XStack, Card } from 'tamagui';
import { projectPumps } from '@kinhale/sync';
import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';

export default function OnboardingPlanPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPlan = useDocStore((s) => s.appendPlan);
  const doc = useDocStore((s) => s.doc);

  const maintenancePumps =
    doc !== null
      ? projectPumps(doc).filter((p) => p.pumpType === 'maintenance' && !p.isExpired)
      : [];

  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(
    maintenancePumps.length === 1 ? (maintenancePumps[0]?.pumpId ?? null) : null,
  );
  const [hoursStr, setHoursStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (selectedPumpId === null) {
      setError(t('onboarding.plan.saveError'));
      return;
    }
    const scheduledHoursUtc = hoursStr
      .split(',')
      .map((h) => parseInt(h.trim(), 10))
      .filter((h) => !isNaN(h));
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
          pumpId: selectedPumpId,
          scheduledHoursUtc,
          startAtMs: Date.now(),
          endAtMs: null,
        },
        deviceId,
        kp.secretKey,
      );
      router.push('/journal');
    } catch {
      setError(t('onboarding.plan.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) return null;

  if (maintenancePumps.length === 0) {
    return (
      <YStack padding="$4" gap="$4">
        <H1>{t('onboarding.plan.title')}</H1>
        <Card padding="$4" gap="$3">
          <Text fontWeight="bold" fontSize="$5">
            {t('onboarding.plan.noMaintenancePumpTitle')}
          </Text>
          <Text>{t('onboarding.plan.noMaintenancePumpBody')}</Text>
          <Button
            onPress={() => router.push('/onboarding/pump')}
            theme="active"
            accessibilityLabel={t('onboarding.plan.goToPumpCta')}
          >
            {t('onboarding.plan.goToPumpCta')}
          </Button>
        </Card>
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('onboarding.plan.title')}</H1>

      {maintenancePumps.length > 1 && (
        <>
          <Text fontWeight="600">{t('onboarding.plan.pumpSelectLabel')}</Text>
          <XStack flexWrap="wrap" gap="$2">
            {maintenancePumps.map((p) => (
              <Button
                key={p.pumpId}
                onPress={() => setSelectedPumpId(p.pumpId)}
                theme={selectedPumpId === p.pumpId ? 'active' : null}
              >
                {p.name}
              </Button>
            ))}
          </XStack>
        </>
      )}

      <Text fontWeight="600">{t('onboarding.plan.hoursLabel')}</Text>
      <Input
        value={hoursStr}
        onChangeText={setHoursStr}
        placeholder={t('onboarding.plan.hoursPlaceholder')}
      />

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <Button onPress={() => void handleSave()} disabled={loading} marginTop="$2">
        {loading ? t('onboarding.plan.saving') : t('onboarding.plan.save')}
      </Button>
    </YStack>
  );
}
