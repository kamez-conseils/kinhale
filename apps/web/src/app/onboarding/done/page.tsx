'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { projectChild } from '@kinhale/sync';
import {
  DoneStep,
  OnboardingAside,
  OnboardingCTA,
  OnboardingShell,
  type OnboardingShellCopy,
} from '@kinhale/ui/onboarding';

import { useDocStore } from '../../../stores/doc-store';
import { useRequireAuth } from '../../../lib/useRequireAuth';

export default function OnboardingDonePage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const doc = useDocStore((s) => s.doc);

  // Récupère le prénom de l'enfant pour personnaliser le titre. Si
  // l'utilisateur a sauté l'étape Welcome (pas créé d'enfant), on tombe
  // sur un libellé générique.
  const childName = React.useMemo(() => {
    if (doc === null) return '';
    return projectChild(doc)?.firstName ?? '';
  }, [doc]);

  const shellCopy: OnboardingShellCopy = {
    skip: t('onboarding.shellSkip'),
    back: t('onboarding.shellBack'),
  };

  const stepCopy = {
    title: t('onboarding.done.title'),
    sub: t('onboarding.done.sub'),
    nextReminder: t('onboarding.done.nextReminder'),
  };

  if (!authenticated) return null;

  return (
    <OnboardingShell
      step="done"
      copy={shellCopy}
      aside={
        <OnboardingAside
          step="done"
          copy={{
            eyebrow: t('onboarding.done.asideEyebrow'),
            title: t('onboarding.done.asideTitle'),
            body: t('onboarding.done.asideBody'),
          }}
        />
      }
      primaryCta={
        <OnboardingCTA
          label={t('onboarding.done.cta')}
          onPress={() => router.push('/')}
          testID="onboarding-done-cta"
        />
      }
    >
      <DoneStep copy={stepCopy} childName={childName} />
    </OnboardingShell>
  );
}
