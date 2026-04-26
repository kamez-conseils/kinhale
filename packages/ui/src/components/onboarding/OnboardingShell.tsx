import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { ProgressDots } from './ProgressDots';
import type { OnboardingShellCopy, OnboardingStep } from './types';
import { ONBOARDING_STEPS } from './types';

interface OnboardingShellProps {
  step: OnboardingStep;
  copy: OnboardingShellCopy;
  /** Affiché à droite du dock CTA, sous le bouton primaire. */
  primaryCta: React.ReactNode;
  /** Optionnel — bouton secondaire texte (ex: "Faire plus tard"). */
  secondaryCta?: React.ReactNode;
  /** Le contenu de l'étape (formulaire, illustration, etc.). */
  children: React.ReactNode;
  /** Cliqué quand l'utilisateur revient en arrière. Caché à l'étape 0. */
  onBack?: (() => void) | undefined;
  /** Cliqué quand l'utilisateur clique sur "Passer". Caché à l'étape 4 (done). */
  onSkip?: (() => void) | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

// Frame partagée des écrans onboarding (maquette `Kinhale Onboarding.html`,
// helper `StepFrame` + barre de progression `ProgressDots`).
//
// Layout :
//   ┌──────────────────────────────────────┐
//   │ ← back     • • · · ·     Passer     │  ← top
//   ├──────────────────────────────────────┤
//   │                                      │
//   │     Slot enfant (titre, form, ...)   │  ← scrollable
//   │                                      │
//   ├──────────────────────────────────────┤
//   │  [   Continuer (CTA primaire)   ]    │  ← footer
//   │       Faire plus tard (sec.)         │
//   └──────────────────────────────────────┘
export function OnboardingShell({
  step,
  copy,
  primaryCta,
  secondaryCta,
  children,
  onBack,
  onSkip,
  theme = 'kinhale_light',
}: OnboardingShellProps): React.JSX.Element {
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const isFirstStep = stepIndex <= 0;
  const isDone = step === 'done';

  return (
    <Theme name={theme}>
      <YStack flex={1} minHeight="100vh" backgroundColor="$background">
        {/* Top bar — back + dots + skip */}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal={20}
          paddingVertical={14}
        >
          <Stack width={32} height={32} alignItems="center" justifyContent="center">
            {!isFirstStep && onBack && (
              <Text
                tag="button"
                onPress={onBack}
                color="$colorMore"
                fontSize={20}
                fontWeight="500"
                paddingHorizontal={6}
                paddingVertical={6}
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                accessibilityRole="button"
                accessibilityLabel={copy.back}
                hoverStyle={{ opacity: 0.7 }}
              >
                ←
              </Text>
            )}
          </Stack>

          {!isDone && (
            <ProgressDots
              current={stepIndex}
              total={ONBOARDING_STEPS.length - 1}
              ariaLabel={`${stepIndex + 1}/${ONBOARDING_STEPS.length - 1}`}
            />
          )}

          <Stack width={70} alignItems="flex-end">
            {!isDone && onSkip && (
              <Text
                tag="button"
                onPress={onSkip}
                color="$colorMore"
                fontSize={13}
                fontWeight="500"
                paddingHorizontal={6}
                paddingVertical={6}
                cursor="pointer"
                backgroundColor="transparent"
                borderWidth={0}
                accessibilityRole="button"
                accessibilityLabel={copy.skip}
                hoverStyle={{ opacity: 0.7 }}
              >
                {copy.skip}
              </Text>
            )}
          </Stack>
        </XStack>

        {/* Slot enfant — scrollable, padding horizontal généreux */}
        <YStack
          flex={1}
          paddingHorizontal={24}
          paddingBottom={24}
          minHeight={0}
          style={{ overflow: 'auto' }}
        >
          {children}
        </YStack>

        {/* Footer CTA — bordure top, dock fixe en bas */}
        <YStack
          paddingHorizontal={24}
          paddingTop={14}
          paddingBottom={26}
          borderTopWidth={0.5}
          borderTopColor="$borderColor"
          gap={4}
        >
          {primaryCta}
          {secondaryCta}
        </YStack>
      </YStack>
    </Theme>
  );
}
