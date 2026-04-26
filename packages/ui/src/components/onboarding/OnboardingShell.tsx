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
  /**
   * Panneau gauche optionnel affiché en layout dual-pane desktop
   * (≥ 1024 px). Sur mobile il est caché. Voir `OnboardingAside` pour le
   * composant standard à passer ici, ou utiliser le slot pour un visuel
   * personnalisé.
   */
  aside?: React.ReactNode;
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
  aside,
  theme = 'kinhale_light',
}: OnboardingShellProps): React.JSX.Element {
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const isFirstStep = stepIndex <= 0;
  const isDone = step === 'done';

  // Slot principal — la "phone-like form column" sur desktop, plein écran
  // sur mobile. Le content lui-même est inchangé entre les deux layouts ;
  // ce sont les wrappers (panneau gauche + card sur desktop, juste le
  // shell sur mobile) qui changent.
  const shell = (
    <YStack
      flex={1}
      backgroundColor="$background"
      // Sur desktop : pas de minHeight 100vh — la card phone-like a sa
      // hauteur fixée à 640 par l'aside-frame. Sur mobile : remplit la
      // viewport.
      $maxSm={{ minHeight: '100vh' }}
    >
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
  );

  // ── Layout dual-pane desktop ───────────────────────────────────────────
  // Si un `aside` est fourni : sur desktop ≥ 1024 px on rend le panneau
  // gauche + une card "phone-like" 460×640 à droite contenant le shell.
  // Sur mobile (< 1024 px) on cache l'aside et on affiche juste le shell.
  if (aside) {
    return (
      <Theme name={theme}>
        <XStack
          flex={1}
          minHeight="100vh"
          backgroundColor="$surface2"
          $maxLg={{ flexDirection: 'column' }}
        >
          <Stack flex={1} $maxLg={{ display: 'none' }}>
            {aside}
          </Stack>
          <Stack
            flex={1}
            alignItems="center"
            justifyContent="center"
            padding={40}
            $maxLg={{ padding: 0, alignItems: 'stretch', justifyContent: 'flex-start' }}
          >
            <Stack
              width={460}
              height={640}
              borderRadius={22}
              borderWidth={0.5}
              borderColor="$borderColor"
              backgroundColor="$background"
              $maxLg={{ width: '100%', height: 'auto', flex: 1, borderRadius: 0, borderWidth: 0 }}
              style={{
                overflow: 'hidden',
                boxShadow: '0 24px 80px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)',
              }}
            >
              {shell}
            </Stack>
          </Stack>
        </XStack>
      </Theme>
    );
  }

  return <Theme name={theme}>{shell}</Theme>;
}
